# timetravelmap
map with various historical aerial photos. use a slider to time travel.

# workflow

## python scripts

* gather images from source
* crop images manually

## QGIS
This will be one large project with each dataset (year) in a folder in the layers view.

* import into QGIS using Layer->georeferencer
  * pick 3 or 4 points
  * name a new output file (.."modified")
  * pick Helmert and Project CRS in setting
  * click "Use 0 for transparency when needed"
  * click play to export to map
  * minimize window, validate alignment
  * if not satisfactory, maximize georeferencer, change some points, repeat.
  * save layers into their own year folder


### (optional) additional manual transformation
This will get it close - but will need more manual work.

* Raster->Freehand Raster Georeferencer (this was a plugin)
  * open the "modified" image from above
  * this will create a new layer where you can move/rotate/scale, etc
  * once happy, export as a new raster

Repeat for all images, all years.

# lidar images
https://carleton-u.maps.arcgis.com/apps/PublicInformation/index.html?appid=bb86c9b09c7f4e03a061badaf7464245

* to identify existing tile in QGIS
  * select al layer in Layers window (bottom left)
  * choose icon with a pointer pointing at 'i'
  * click on a tile and information will appear in bottom right (Identify Results)
  * this will identify the filename
* then on arcgis site you can click tile, hover over "download TIF" to see the filename
* download TIF
* unzip to lidar directory
* drag into Layers window in QGIS
* right click layer, propties, to adjust brightness/contrast
* then once happy use method below to export to tilemap
* 2014-2015 lidar images are 8-25cm resolution per pixel (so up to zoom 21)
* took dozens of hours so stopped at 19.

# use Raster for zoomed out tiles for lidar
* Go to "Raster" > "Miscellaneous" > "Build Virtual Raster".
* Select all your TIF files.  -> Run
* this will merge all the TIFs into one layer (no squares)
* but it flattens the greyscale dynamic range of each TIF so you lose information
* but when zoomed out it's not a big deal so we'll create tiles using VRT for like zoom levels 12-14

* Export rasters as tiles
  * select layers you want to combine in the export (check year)
  * click on gear icon, search "xyz" (Toolbox)
  * choose Generate XYZ Tiles Directory
    * for extent size view window as you like, click the button
    * minzoom=5, maxzoom=18  (kind of depends on the resolution of the images how far you want to zoom)
    * remove local  timetravelmap/static/data/\<year\>/*
    * set output directory (near bottom) to timetravelmap/static/data/\<year\>
    * generate (run)
    * zip up \<year\>/* to local zip
    * rm timetravelmap/static/data/\<year\>/* on server
    * copy zip over to timetravelmap/static/data/\<year\>
    * unzip on server

This will also produce the tiles and even an HTML file you can try out. (html file is also in log file)

https://www.orrbodies.com/tutorial/generating-tiles-qgis/

# ESRI maps can be opened in QGIS then exported as XYZ tiles
* this will allow us to remove the whitespace in the ESRI maps
* used tilegrabber.py to download the ESRI maps to import into QGIS
* you can map the remote host directly - but I thought this may be faster
* (plus if it doesn't work out, I can serve the ESRI locally - which works better)


## This web app

* Copy the generated tiles into /static/data
* reload app

| Zoom Level | Resolution (meters/pixel) | Map Scale (at 96 dpi) | Width and Height of Map (pixels) |
|------------|---------------------------|------------------------|----------------------------------|
| 0          | 156,543.0339               | 1 : 591,658,710.90     | 512                              |
| 1          | 78,271.51696               | 1 : 295,829,355.45     | 1,024                            |
| 2          | 39,135.75848               | 1 : 147,914,677.73     | 2,048                            |
| 3          | 19,567.87924               | 1 : 73,957,338.86      | 4,096                            |
| 4          | 9,783.939620               | 1 : 36,978,669.43      | 8,192                            |
| 5          | 4,891.969810               | 1 : 18,489,334.72      | 16,384                           |
| 6          | 2,445.984905               | 1 : 9,244,667.36       | 32,768                           |
| 7          | 1,222.992452               | 1 : 4,622,333.68       | 65,536                           |
| 8          | 611.4962263                | 1 : 2,311,166.84       | 131,072                          |
| 9          | 305.7481131                | 1 : 1,155,583.42       | 262,144                          |
| 10         | 152.8740566                | 1 : 577,791.71         | 524,288                          |
| 11         | 76.43702829                | 1 : 288,895.85         | 1,048,576                        |
| 12         | 38.21851414                | 1 : 144,447.93         | 2,097,152                        |
| 13         | 19.10925707                | 1 : 72,223.96          | 4,194,304                        |
| 14         | 9.554728536                | 1 : 36,111.98          | 8,388,608                        |
| 15         | 4.777314268                | 1 : 18,055.99          | 16,777,216                       |
| 16         | 2.388657133                | 1 : 9,028.00           | 33,554,432                       |
| 17         | 1.194328566                | 1 : 4,514.00           | 67,108,864                       |
| 18         | 0.597164263                | 1 : 2,257.00           | 134,217,728                      |
| 19         | 0.298582142                | 1 : 1,128.50           | 268,435,456                      |
| 20         | 0.149291071                | 1 : 564.25             | 536,870,912                      |
| 21         | 0.074645535                | 1 : 282.12             | 1,073,741,824                    |
| 22         | 0.037322768                | 1 : 141.06             | 2,147,483,648                    |
| 23         | 0.018661384                | 1 : 70.53              | 4,294,967,296                    |


# 1879 map
* in order to put this QGIS and align with openstreetmap, I screenshotted smaller parts of the image
* aligning each smaller image individually
* the drawn map (obviously) doens't match perfectly to a real vector map so doing it this way allowed me to align it a little better