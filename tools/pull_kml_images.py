#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import html
import json
import mimetypes
import re
import sys
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
KML_DIR = ROOT / "kml"
OUTPUT_DIR = ROOT / "public" / "images"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
URL_PATTERN = re.compile(r"<gx:imageUrl>(.*?)</gx:imageUrl>")
DEFAULT_SIZE = "2048"
MAX_WORKERS = 8


def extract_urls() -> List[str]:
    urls = set()

    for kml_path in sorted(KML_DIR.glob("*.kml")):
        text = kml_path.read_text(encoding="utf-8", errors="ignore")
        for raw in URL_PATTERN.findall(text):
            url = html.unescape(raw).replace("{size}", DEFAULT_SIZE)
            urls.add(url)

    return sorted(urls)


def guess_extension(url: str, content_type: str | None) -> str:
    if content_type:
        content_type = content_type.split(";", 1)[0].strip().lower()
        guessed = mimetypes.guess_extension(content_type)
        if guessed:
            return guessed

    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        return suffix

    return ".jpg"


def download_image(url: str) -> Tuple[str, Dict[str, str]]:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
    )

    with urlopen(request, timeout=60) as response:
        content_type = response.headers.get("Content-Type")
        extension = guess_extension(url, content_type)
        filename = f"{digest}{extension}"
        output_path = OUTPUT_DIR / filename

        if not output_path.exists():
            output_path.write_bytes(response.read())

    return url, {"file": f"/images/{filename}", "sha256": digest}


def redownload_to_manifest_path(url: str, record: Dict[str, str]) -> Tuple[str, Dict[str, str]]:
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
    )

    relative_path = record.get("file", "").lstrip("/")
    if not relative_path:
        raise ValueError(f"Manifest entry for {url} is missing a file path")

    output_path = ROOT / "public" / relative_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with urlopen(request, timeout=60) as response:
        output_path.write_bytes(response.read())

    return url, record


def load_manifest() -> Dict[str, Dict[str, str]]:
    if not MANIFEST_PATH.exists():
        return {}

    payload = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return payload.get("images", {})


def repair_missing_files() -> int:
    manifest = load_manifest()
    if not manifest:
        print("No manifest found, nothing to repair.")
        return 0

    missing = []
    for url, record in manifest.items():
        relative_path = record.get("file", "").lstrip("/")
        if not relative_path:
            continue

        if not (ROOT / "public" / relative_path).exists():
            missing.append((url, record))

    if not missing:
        print("No missing image files detected.")
        return 0

    print(f"Repairing {len(missing)} missing image files.")
    failures: List[Tuple[str, str]] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {
            executor.submit(redownload_to_manifest_path, url, record): url
            for url, record in missing
        }

        for index, future in enumerate(as_completed(future_map), start=1):
            url = future_map[future]
            try:
                future.result()
                if index % 25 == 0 or index == len(missing):
                    print(f"Repaired {index}/{len(missing)}")
            except (HTTPError, URLError, TimeoutError) as exc:
                failures.append((url, str(exc)))
                print(f"Failed: {url} -> {exc}", file=sys.stderr)
            except Exception as exc:  # noqa: BLE001
                failures.append((url, str(exc)))
                print(f"Failed: {url} -> {exc}", file=sys.stderr)

    if failures:
        print(f"{len(failures)} repairs failed.", file=sys.stderr)
        return 1

    print("Missing image repair complete.")
    return 0


def main() -> int:
    cli = argparse.ArgumentParser()
    cli.add_argument("--repair-missing", action="store_true")
    args = cli.parse_args()

    if args.repair_missing:
        return repair_missing_files()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    urls = extract_urls()
    if not urls:
        print("No gx:imageUrl entries found.")
        return 0

    print(f"Found {len(urls)} unique image URLs.")

    manifest: Dict[str, Dict[str, str]] = {}
    failures: List[Tuple[str, str]] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {executor.submit(download_image, url): url for url in urls}

        for index, future in enumerate(as_completed(future_map), start=1):
            url = future_map[future]
            try:
                source_url, record = future.result()
                manifest[source_url] = record
                if index % 50 == 0 or index == len(urls):
                    print(f"Downloaded {index}/{len(urls)}")
            except (HTTPError, URLError, TimeoutError) as exc:
                failures.append((url, str(exc)))
                print(f"Failed: {url} -> {exc}", file=sys.stderr)
            except Exception as exc:  # noqa: BLE001
                failures.append((url, str(exc)))
                print(f"Failed: {url} -> {exc}", file=sys.stderr)

    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "count": len(manifest),
                "images": manifest,
                "failures": [{"url": url, "error": error} for url, error in failures],
            },
            indent=2,
            sort_keys=True,
        ),
        encoding="utf-8",
    )

    print(f"Saved manifest to {MANIFEST_PATH}")
    print(f"Downloaded {len(manifest)} images.")

    if failures:
        print(f"{len(failures)} downloads failed.", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
