import os
import sys

def rename_files(directory_path):
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.endswith(".png"):
                old_path = os.path.join(root, file)
                new_path = os.path.join(root, file[:-4])  # Remove the last 4 characters (".png")
                
                try:
                    os.rename(old_path, new_path)
                    print(f"Renamed: {old_path} -> {new_path}")
                except Exception as e:
                    print(f"Error renaming {old_path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python script.py <directory_path>")
        sys.exit(1)

    directory_path = sys.argv[1]
    if not os.path.isdir(directory_path):
        print(f"Error: {directory_path} is not a valid directory.")
        sys.exit(1)

    rename_files(directory_path)