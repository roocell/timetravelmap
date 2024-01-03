import requests
import os
import time
import math

# time in seconds between requests to don't overload the provider
sleep_time = 0.1

# captured extents by placing marker just outside of tiles served up from ottawa.ca

url_pattern = "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1928/MapServer/tile/{z}/{x}/{y}"
output_dir = "tiles_1928"
min_latitude = 45.383417682929284
max_latitude = 45.46365889877761
min_longitude = -75.77257071621716
max_longitude = -75.56348715908825
min_zoom_level = 13
max_zoom_level = 18

# url_pattern = "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1965/MapServer/tile/{z}/{x}/{y}"
# output_dir = "tiles_1965"
# min_latitude = 45.250479757813
# max_latitude = 45.50177510698874
# min_longitude = -75.97354888916017
# max_longitude = -75.41942596435548
# min_zoom_level = 13
# max_zoom_level = 18

# url_pattern = "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1958/MapServer/tile/{z}/{x}/{y}"
# output_dir = "tiles_1958"
# min_latitude = 45.308941579503745
# max_latitude = 45.49359307512666
# min_longitude = -75.89183807373048
# max_longitude = -75.50354003906251
# min_zoom_level = 13
# max_zoom_level = 18

# these ESRI directories seem like they're zoompath
# i.e. - 13 in the above calc gives Tile Row: 2395, Tile Column: 2900
#  which lines up with zoom=4 if I look at chrome dev logs.
# data = [
#     (4, 2930, 2939, 2370, 2379),
#     (5, 5860, 5869, 4740, 4752),
#     (6, 11730, 11740, 9490, 9500),

# ]


# https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Lon./lat._to_tile_numbers
def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (ytile, xtile)

def get_tiles_for_area(min_lat, max_lat, min_lon, max_lon, min_zoom, max_zoom):
    for zoom in range(min_zoom, max_zoom + 1):
        zoompath = zoom - 9 # see above
        if not os.path.exists(os.path.join(output_dir, str(zoompath))):
            os.makedirs(os.path.join(output_dir, str(zoompath)))
    
        # calculate min/max tile numbers based on city of ottawa range            
        c1, r1 = deg2num(min_latitude, min_longitude, zoom)
        c2, r2 = deg2num(max_latitude, max_longitude, zoom)
        mincol = min(c1, c2)
        maxcol = max(c1, c2)
        minrow = min(r1, r2)
        maxrow = max(r1, r2)

        print(f"mincol {mincol} minrow {minrow} maxcol {maxcol} maxrow {maxrow}")
        for c in range(mincol, maxcol+1):

            if not os.path.exists(os.path.join(output_dir, str(zoompath), str(c))):
                os.makedirs(os.path.join(output_dir, str(zoompath), str(c)))

            for r in range(minrow, maxrow+1):

                print(f'Zoom: {zoom} {zoompath}, Tile Column: {c}, Tile Row: {r}')

                url = url_pattern.format(z=(zoompath), x=c, y=r)
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
                filename = os.path.join(
                    os.path.join(output_dir, str(zoompath), str(c)), f"{r}.png"
                )
                with open(filename, "wb") as f:
                    f.write(response.content)

                # Print a message to indicate progress
                print(f"Downloaded tile {(zoompath)}/{c}/{r}")
                time.sleep(sleep_time)


get_tiles_for_area(min_latitude, max_latitude, min_longitude, max_longitude, min_zoom_level, max_zoom_level)


