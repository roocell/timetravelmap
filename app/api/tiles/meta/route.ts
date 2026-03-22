import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

async function getLayerZoomRange(layerDir: string) {
  const entries = await readdir(layerDir, { withFileTypes: true });
  const zoomLevels = entries
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number.parseInt(entry.name, 10))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (zoomLevels.length === 0) {
    return null;
  }

  return {
    minNativeZoom: zoomLevels[0],
    maxNativeZoom: zoomLevels[zoomLevels.length - 1]
  };
}

export async function GET() {
  const tilesRoot = path.join(process.cwd(), "public", "tiles");
  const response: Record<string, { minNativeZoom: number; maxNativeZoom: number }> = {};

  try {
    const entries = await readdir(tilesRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const zoomRange = await getLayerZoomRange(path.join(tilesRoot, entry.name));
      if (zoomRange) {
        response[entry.name] = zoomRange;
      }
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({});
  }
}
