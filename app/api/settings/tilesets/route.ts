import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  AccessDeniedError,
  AuthRequiredError,
  requireStackUser
} from "../../../../lib/feature-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TilesetRow = {
  id: string;
  name: string | null;
  provider_type: string;
  is_visible: boolean;
  url: string;
  sort_order: number;
};

const TILESET_SUFFIX = "/{z}/{x}/{y}.png";
const ARCGIS_TILE_SUFFIX = "/tile/{z}/{y}/{x}";
const ARCGIS_MAPSERVER_MARKER = "/MapServer";
const WMS_SERVICE_MARKER = "service=wms";

type TilesetProviderType = "xyz" | "arcgis" | "wms";
type TilesetInput = {
  name?: unknown;
  type?: unknown;
  url?: unknown;
  visible?: unknown;
};

function stripArcGisTilePath(value: string) {
  const normalized = value.replace(/\/+$/, "");
  const mapServerIndex = normalized.toLowerCase().indexOf(ARCGIS_MAPSERVER_MARKER.toLowerCase());
  if (mapServerIndex === -1) {
    return normalized;
  }

  return normalized.slice(0, mapServerIndex + ARCGIS_MAPSERVER_MARKER.length);
}

function normalizeTilesetBaseUrl(raw: string) {
  const trimmed = raw.trim();
  const withoutXyzSuffix = trimmed.endsWith(TILESET_SUFFIX)
    ? trimmed.slice(0, -TILESET_SUFFIX.length)
    : trimmed;
  const withoutArcGisTemplate = withoutXyzSuffix.endsWith(ARCGIS_TILE_SUFFIX)
    ? withoutXyzSuffix.slice(0, -ARCGIS_TILE_SUFFIX.length)
    : withoutXyzSuffix;
  const withoutArcGisTilePath = stripArcGisTilePath(withoutArcGisTemplate);
  const withoutTrailingSlash = withoutArcGisTilePath.replace(/\/+$/, "");

  let parsed: URL;

  try {
    parsed = new URL(withoutTrailingSlash);
  } catch {
    throw new Error(`Invalid tileset URL: ${raw}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Tileset URLs must start with http:// or https://: ${raw}`);
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/+$/, "");
}

function normalizeTilesetType(value: unknown, url: string): TilesetProviderType {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "xyz" || normalized === "arcgis" || normalized === "wms") {
    return normalized;
  }

  if (url.toLowerCase().includes(ARCGIS_MAPSERVER_MARKER.toLowerCase())) {
    return "arcgis";
  }

  if (url.toLowerCase().includes(WMS_SERVICE_MARKER) || url.toLowerCase().includes("layers=")) {
    return "wms";
  }

  return "xyz";
}

function normalizeTilesetEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: Array<{
    name: string | null;
    type: TilesetProviderType;
    url: string;
    visible: boolean;
  }> = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const rawEntry: TilesetInput =
      typeof entry === "string" ? { url: entry } : entry && typeof entry === "object" ? entry : {};
    const raw = String(rawEntry.url ?? "").trim();
    if (!raw) {
      continue;
    }
    const url = normalizeTilesetBaseUrl(raw);
    const type = normalizeTilesetType(rawEntry.type, url);
    const name = String(rawEntry.name ?? "").trim() || null;
    const visible = rawEntry.visible === undefined ? true : Boolean(rawEntry.visible);

    const dedupeKey = `${type}:${url}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push({
      name,
      type,
      url,
      visible
    });
  }

  return normalized;
}

export async function PUT(request: NextRequest) {
  const { prisma } = await import("../../../../lib/prisma");

  try {
    const user = await requireStackUser(request);
    const body = await request.json().catch(() => ({}));
    const tilesets = normalizeTilesetEntries(body?.tilesets);

    await prisma.$transaction([
      prisma.$executeRaw(
        Prisma.sql`
          delete from timetravelmap.user_tilesets
          where owner_id = ${user.id}
        `
      ),
      ...tilesets.map((tileset, index) =>
        prisma.$executeRaw(
          Prisma.sql`
            insert into timetravelmap.user_tilesets (
              owner_id,
              name,
              provider_type,
              is_visible,
              url,
              sort_order
            )
            values (
              ${user.id},
              ${tileset.name},
              ${tileset.type},
              ${tileset.visible},
              ${tileset.url},
              ${index}
            )
          `
        )
      )
    ]);

    const rows = await prisma.$queryRaw<TilesetRow[]>(
      Prisma.sql`
        select
          id,
          name,
          provider_type,
          is_visible,
          url,
          sort_order
        from timetravelmap.user_tilesets
        where owner_id = ${user.id}
        order by sort_order asc, created_at asc
      `
    );

    return NextResponse.json({
      tilesets: rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.provider_type,
        visible: row.is_visible,
        url: row.url,
        sortOrder: row.sort_order
      }))
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save tilesets" },
      { status: 400 }
    );
  }
}
