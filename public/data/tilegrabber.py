import requests
import os
import time
import math

# time in seconds between requests to don't overload the provider
sleep_time = 0.1

# captured extents by placing marker just outside of tiles served up from ottawa.ca
# best to be very conservative when picking coordinates because any errors in the
# coords -> col/row calculations can be accounted for and this script will perhaps
# just request tiles that don't exist.
# I say this because I feel like the rows calc is incorrect (missing tiles at the top/bottom)

# run in windows powershell
# python.exe tilegrabber | Tee-Object -FilePath output.txt

# url_pattern = "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1928/MapServer/tile/{z}/{y}/{x}"
# output_dir = "1928_esri"
# # 45.36842857439341, -75.76498031616212   (bottom left)
# # 45.47541990014997, -75.56705474853517   (top right)
# min_latitude = 45.36842857439341
# max_latitude = 45.47541990014997
# min_longitude = -75.76498031616212
# max_longitude = -75.56705474853517
# min_zoom_level = 13
# max_zoom_level = 18

# url_pattern = "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1965/MapServer/tile/{z}/{y}/{x}"
# output_dir = "1965_esri"
# min_latitude = 45.250479757813
# max_latitude = 45.50177510698874
# min_longitude = -75.97354888916017
# max_longitude = -75.41942596435548
# min_zoom_level = 13
# max_zoom_level = 18

url_pattern = "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1958/MapServer/tile/{z}/{y}/{x}"
output_dir = "1958_esri"
min_latitude = 45.308941579503745
max_latitude = 45.49359307512666
min_longitude = -75.89183807373048
max_longitude = -75.50354003906251
min_zoom_level = 13
max_zoom_level = 18

# these ESRI directories seem like they're zoompath
# i.e. - 13 in the above calc gives Tile Row: 2395, Tile Column: 2900
#  which lines up with zoom=4 if I look at chrome dev logs.
# data = [
#     (4, 2930, 2939, 2370, 2379),
#     (5, 5860, 5869, 4740, 4752),
#     (6, 11730, 11740, 9490, 9500),

# ]

# when tried using downloaded tiles:
# the directory format on them is swapped and no png extension
# ESRI is tile/{z}/{y}/{x}   (zoom/row/column)
# normal is {z}/{x}/{y}.png   (zoom/column/row.png)
# also when tried locally the zoom levels used are 13-18 not 4-9


# https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Lon./lat._to_tile_numbers
def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (ytile, xtile)

def num2deg(xtile, ytile, zoom):
  n = 1 << zoom
  lon_deg = xtile / n * 360.0 - 180.0
  lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
  lat_deg = math.degrees(lat_rad)
  return lat_deg, lon_deg

def get_tiles_for_area(min_lat, max_lat, min_lon, max_lon, min_zoom, max_zoom):
    global output_dir

    output_dir = os.path.join(output_dir, "tile")

    for zoom in range(min_zoom, max_zoom + 1):
        zoompathserver = zoom - 9 # see above
        zoompathlocal = zoom # keep local dir as larger zoom value
        if not os.path.exists(os.path.join(output_dir, str(zoompathlocal))):
            os.makedirs(os.path.join(output_dir, str(zoompathlocal)))
    
        # calculate min/max tile numbers based on city of ottawa range            
        r1, c1 = deg2num(min_latitude, min_longitude, zoom)
        r2, c2 = deg2num(max_latitude, max_longitude, zoom)
        mincol = min(c1, c2)
        maxcol = max(c1, c2)
        minrow = min(r1, r2)
        maxrow = max(r1, r2)

        print(f"mincol {mincol} minrow {minrow} maxcol {maxcol} maxrow {maxrow}")
        for r in range(minrow, maxrow+1):

            if not os.path.exists(os.path.join(output_dir, str(zoompathlocal), str(r))):
                os.makedirs(os.path.join(output_dir, str(zoompathlocal), str(r)))

            for c in range(mincol, maxcol+1):
                # check if file exist locally before proceeding
                # ESRI does not have png extension
                filename = os.path.join(
                    os.path.join(output_dir, str(zoompathlocal), str(r)), f"{c}"
                )
                if os.path.exists(filename):
                    print(f"skipping {filename}")
                    continue

                print(f'Zoom: {zoom} {zoompathlocal}, Tile Row: {r}, Tile Column: {c} {num2deg(ytile=r, xtile=c, zoom=zoom)}')

                url = url_pattern.format(z=(zoompathserver), x=c, y=r)
                print(f"trying {url}")

                try:
                    response = requests.get(url)
                    if response.status_code == 404:
                        print(f"The requested resource was not found (HTTP 404)")
                        continue
                    elif response.status_code != 200:
                        print(f"Request failed with status code: {response.status_code}")

                except Exception as e:
                    print(f"An unexpected error occurred: {e}")
                    continue

                # Save the tile to the output directory
                with open(filename, "wb") as f:
                    f.write(response.content)

                # Print a message to indicate progress
                print(f"Downloaded tile {output_dir} {(zoompathlocal)}/{r}/{c}")
                time.sleep(sleep_time)


get_tiles_for_area(min_latitude, max_latitude, min_longitude, max_longitude, min_zoom_level, max_zoom_level)


