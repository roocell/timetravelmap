import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const ARCGIS_MAPSERVER_MARKER = "/MapServer";
const WEB_MERCATOR_BASE_RESOLUTION = 156543.03392804097;

type ArcGisLod = {
  level?: number | string | null;
  levelID?: number | string | null;
  resolution?: number | string | null;
};

type ArcGisMetadata = {
  isTiled?: boolean;
  minNativeZoom?: number;
  maxNativeZoom?: number;
  lods?: Array<{
    level: number;
    resolution: number;
  }>;
};

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolutionToWebMercatorZoom(value: unknown) {
  const resolution = toFiniteNumber(value);
  if (!resolution || resolution <= 0) {
    return null;
  }

  const zoom = Math.log2(WEB_MERCATOR_BASE_RESOLUTION / resolution);
  return Number.isFinite(zoom) ? Math.round(zoom) : null;
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
    const lodMetadata = lods
      .map((lod) => {
        const level = toFiniteNumber(lod?.level ?? lod?.levelID);
        const resolution = toFiniteNumber(lod?.resolution);
        if (level === null || resolution === null) {
          return null;
        }

        return { level, resolution };
      })
      .filter((lod): lod is { level: number; resolution: number } => Boolean(lod))
      .sort((a, b) => a.level - b.level);
    const isTiled =
      Boolean(payload?.singleFusedMapCache) ||
      lodMetadata.length > 0 ||
      capabilities.split(",").map((value) => value.trim()).includes("TilesOnly");
    const nativeZoomLevels = lodMetadata
      .map((lod) => resolutionToWebMercatorZoom(lod.resolution))
      .filter((zoom): zoom is number => zoom !== null)
      .sort((a, b) => a - b);

    if (lodMetadata.length === 0) {
      return isTiled ? { isTiled } : null;
    }

    return {
      isTiled,
      minNativeZoom: nativeZoomLevels[0],
      maxNativeZoom: nativeZoomLevels[nativeZoomLevels.length - 1],
      lods: lodMetadata
    } satisfies ArcGisMetadata;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const tilesRoot = path.join(process.cwd(), "public", "tiles");
  const response: Record<string, ArcGisMetadata> = {};

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
