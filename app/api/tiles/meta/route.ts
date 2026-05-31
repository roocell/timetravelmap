import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const ARCGIS_MAPSERVER_MARKER = "/MapServer";

type ArcGisLod = {
  level?: number | string | null;
  levelID?: number | string | null;
};

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

async function getArcGisMetadata(baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl}?f=pjson`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    const lods = Array.isArray(payload?.tileInfo?.lods) ? (payload.tileInfo.lods as ArcGisLod[]) : [];
    const capabilities = String(payload?.capabilities ?? "");
    const isTiled = capabilities.split(",").includes("TilesOnly");
    const minLOD = toFiniteNumber(payload?.minLOD);
    const maxLOD = toFiniteNumber(payload?.maxLOD);
    const levels = lods
      .map((lod) => Number(lod?.level ?? lod?.levelID))
      .filter(Number.isFinite)
      .sort((a: number, b: number) => a - b);

    if (levels.length === 0) {
      return isTiled ? { isTiled } : null;
    }

    return {
      isTiled,
      minNativeZoom: minLOD ?? levels[0],
      maxNativeZoom: maxLOD ?? levels[levels.length - 1]
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const tilesRoot = path.join(process.cwd(), "public", "tiles");
  const response: Record<string, { minNativeZoom?: number; maxNativeZoom?: number; isTiled?: boolean }> = {};

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

    const remoteUrls = request.url
      ? new URL(request.url).searchParams.getAll("url").map((value) => value.trim()).filter(Boolean)
      : [];

    for (const remoteUrl of remoteUrls) {
      if (!remoteUrl.toLowerCase().includes(ARCGIS_MAPSERVER_MARKER.toLowerCase())) {
        continue;
      }

      const metadata = await getArcGisMetadata(remoteUrl);
      if (metadata) {
        response[remoteUrl] = metadata;
      }
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({});
  }
}
