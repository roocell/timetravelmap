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
  * make sure you use the 'default' CRS param (otherwise you can't open in the next step)
TODO: try Helmert transformation - might not need next step.

### (optional) additional manual transformation
This will get it close - but will need more manual work.

* Raster->Freehand Raster Georeferencer (this was a plugin)
  * open the "modified" image from above
  * this will create a new layer where you can move/rotate/scale, etc
  * once happy, export as a new raster

Repeat for all images, all years.

* Export rasters as tiles
  * only show one layer year
  * Generate XYZ Tiles (Directory)

This will also produce the tiles and even an HTML file you can try out.

https://www.orrbodies.com/tutorial/generating-tiles-qgis/

## This web app

* Copy the generated tiles into /static/data
* reload app
