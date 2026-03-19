# GDAL with python can generate tiles from an image.
# trick would be to align (scale/rotate) the image to real world coordinates before generating tiles
# apparently (QGIS can do this) https://qgis.org/en/site/



from osgeo import gdal
from osgeo import gdalconst

def image_to_tiles_with_georeferencing(input_image, output_directory, ulx, uly, lrx, lry, tile_format='PNG', tile_size=256):
    # Open the input image
    input_dataset = gdal.Open(input_image, gdalconst.GA_ReadOnly)
    if input_dataset is None:
        raise Exception("Could not open the input image.")

    # Set the format options
    format_options = ['TILED=YES', 'COMPRESS=PNG']

    # Generate tiles
    for i in range(0, input_dataset.RasterXSize, tile_size):
        for j in range(0, input_dataset.RasterYSize, tile_size):
            tile_name = f"{output_directory}/tile_{i}_{j}.{tile_format.lower()}"
            command = [
                'gdal_translate',
                '-of', tile_format,
                '-srcwin', f'{i}', f'{j}', f'{tile_size}', f'{tile_size}',
                '-a_ullr', str(ulx), str(uly), str(lrx), str(lry),
                '-co', ' '.join(format_options),
                input_image,
                tile_name
            ]
            gdal.Translate(tile_name, input_image, options=gdal.TranslateOptions(options=command))

    # Close the input dataset
    input_dataset = None

# Example usage with georeferencing information
input_image_path = 'path/to/your/input_image.tif'
output_directory_path = 'path/to/your/output_tiles'
ulx, uly, lrx, lry = -75.721, 45.398, -75.719, 45.396  # Replace with your georeferencing coordinates

image_to_tiles_with_georeferencing(input_image_path, output_directory_path, ulx, uly, lrx, lry)
