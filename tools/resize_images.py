#!/usr/bin/env python3
# Install the dependency: python3 -m pip install Pillow
# From the project root, preview changes without modifying files:
#   python3 tools/resize_images.py public/images --dry-run
# Resize images in that directory and all its subdirectories:
#   python3 tools/resize_images.py public/images
# Replace public/images with any directory path; quote paths containing spaces.
# Files are replaced in place, keeping their filenames. Back up originals first.
# Images fit within 960x540 without cropping, stretching, or enlarging small images.
# Animated/multi-page images are skipped. Database metadata is not updated.
"""Recursively resize images in place to fit 960x540. Requires Pillow."""

from __future__ import annotations

import argparse
import os
import stat
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    raise SystemExit("Install Pillow first: python3 -m pip install Pillow")

MAX_SIZE = (960, 540)
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".bmp", ".avif"}


def resize_image(image_path: Path, dry_run: bool = False) -> str:
    with Image.open(image_path) as original:
        # Leave animations and multi-page files intact instead of dropping frames.
        if getattr(original, "n_frames", 1) > 1:
            print(f"SKIP multi-frame image: {image_path}")
            return "skipped"

        image_format = original.format
        image = ImageOps.exif_transpose(original)
        old_size = image.size
        if old_size[0] <= MAX_SIZE[0] and old_size[1] <= MAX_SIZE[1]:
            return "unchanged"

        image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
        print(
            f"{'WOULD RESIZE' if dry_run else 'RESIZE'} {image_path}: "
            f"{old_size[0]}x{old_size[1]} -> {image.width}x{image.height}"
        )
        if dry_run:
            return "resized"

        options = {}
        if image.info.get("icc_profile"):
            options["icc_profile"] = image.info["icc_profile"]
        exif = image.getexif()
        if exif and image_format in {"JPEG", "PNG", "WEBP", "TIFF", "AVIF"}:
            options["exif"] = exif.tobytes()
        if image_format in {"JPEG", "WEBP", "AVIF"}:
            options["quality"] = 90

        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(
                dir=image_path.parent, prefix=".resize-", suffix=image_path.suffix, delete=False
            ) as temporary:
                temporary_path = Path(temporary.name)
            image.save(temporary_path, format=image_format, **options)
            os.chmod(temporary_path, stat.S_IMODE(image_path.stat().st_mode))
        except BaseException:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
            raise

    # Close the source before replacing it, including on Windows.
    try:
        os.replace(temporary_path, image_path)
    finally:
        temporary_path.unlink(missing_ok=True)
    return "resized"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Directory to scan recursively; files are replaced in place")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without modifying any files")
    args = parser.parse_args()
    directory = args.directory.expanduser().resolve()
    if not directory.is_dir():
        parser.error(f"Not a directory: {directory}")

    counts = dict(resized=0, unchanged=0, skipped=0, failed=0)
    for image_path in sorted(directory.rglob("*")):
        if image_path.is_symlink() or not image_path.is_file() or image_path.suffix.lower() not in EXTENSIONS:
            continue
        try:
            counts[resize_image(image_path, args.dry_run)] += 1
        except (OSError, ValueError, Image.DecompressionBombError) as error:
            counts["failed"] += 1
            print(f"ERROR {image_path}: {error}", file=sys.stderr)

    print(
        f"{'Would resize' if args.dry_run else 'Resized'}: {counts['resized']}; "
        f"unchanged: {counts['unchanged']}; skipped: {counts['skipped']}; failed: {counts['failed']}"
    )
    return 1 if counts["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
