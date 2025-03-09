import os
import sys
from PIL import Image

def is_white_image(image_path):
    """Check if the image is completely white."""
    try:
        with Image.open(image_path) as img:
            img = img.convert("RGBA")  # Convert to RGBA to check transparency
            pixels = img.getdata()

            # Check if all pixels are near-white (R, G, B ≥ 253)
            for pixel in pixels:
                r, g, b, a = pixel
                if not ((r >= 253 and g >= 253 and b >= 253) or a == 0):  
                    return False
            return True
    except Exception as e:
        print(f"Error opening image {image_path}: {e}")
        return False

def make_white_transparent(image_path):
    """Open an image, change white pixels to transparent, and save the image."""
    try:
        with Image.open(image_path) as img:
            img = img.convert("RGBA")  # Convert to RGBA to work with transparency
            pixels = img.load()

            # Loop through all pixels and replace white with transparent
            for y in range(img.height):
                for x in range(img.width):
                    r, g, b, a = pixels[x, y]
                    if r >= 253 and g >= 253 and b >= 253:  # White pixel
                        pixels[x, y] = (0, 0, 0, 0)  # Make it transparent

            # Save the modified image
            img.save(image_path)

    except Exception as e:
        print(f"Error processing {image_path}: {e}")

# flood fill algorithm
def remove_border_white(image_path, output_path, threshold=253):
    """Removes white pixels bordering the image, making them transparent."""
    try:
        with Image.open(image_path) as img:
            img = img.convert("RGBA")  # Ensure it has an alpha channel
            pixels = img.load()

            width, height = img.size

            # Identify pixels to process using a flood-fill approach from the edges
            stack = []
            visited = set()

            # Add all edge pixels that are white (threshold for near-white)
            for x in range(width):
                stack.append((x, 0))       # Top edge
                stack.append((x, height-1)) # Bottom edge
            for y in range(height):
                stack.append((0, y))       # Left edge
                stack.append((width-1, y)) # Right edge

            while stack:
                x, y = stack.pop()
                if (x, y) in visited:
                    continue
                visited.add((x, y))

                if 0 <= x < width and 0 <= y < height:
                    r, g, b, a = pixels[x, y]
                    if r >= threshold and g >= threshold and b >= threshold and a > 0:  # Near-white and not already transparent
                        pixels[x, y] = (0, 0, 0, 0)  # Make it transparent

                        # Add neighboring pixels to check
                        stack.extend([(x-1, y), (x+1, y), (x, y-1), (x, y+1)])

            # Save the modified image
            img.save(output_path)

    except Exception as e:
        print(f"Error processing {image_path}: {e}")

def delete_white_pngs(root_dir):
    """Recursively go through directories and delete white PNG files."""
    for root, dirs, files in os.walk(root_dir):

        dirs.sort()   # Sort subdirectories alphabetically
        files.sort()  # Sort files alphabetically

        for file in files:
            if file.lower().endswith(".png"):
                file_path = os.path.join(root, file)

                if is_white_image(file_path):
                    print(f"Deleting white PNG: {file_path}")
                    os.remove(file_path)
                    continue

                # make_white_transparent(file_path)
                remove_border_white(file_path, file_path)
                print(f"Processed {file_path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <directory>")
        sys.exit(1)

    root_directory = sys.argv[1]
    
    if not os.path.isdir(root_directory):
        print(f"Error: {root_directory} is not a valid directory.")
        sys.exit(1)

    delete_white_pngs(root_directory)
