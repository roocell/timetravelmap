import { Prisma, type PrismaClient } from "@prisma/client";

export type TilesetProviderType = "xyz" | "arcgis" | "wms";

export const DEFAULT_USER_TILESETS: Array<{
  name: string;
  type: TilesetProviderType;
  url: string;
  visible: boolean;
}> = [
  {
    name: "1928",
    type: "arcgis",
    url: "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1928/MapServer",
    visible: true
  },
  {
    name: "1930s",
    type: "xyz",
    url: "https://timetravelmap.roocell.com/tiles/1930s",
    visible: true
  },
  {
    name: "1945",
    type: "xyz",
    url: "https://timetravelmap.roocell.com/tiles/1945",
    visible: true
  },
  {
    name: "1954",
    type: "xyz",
    url: "https://timetravelmap.roocell.com/tiles/1954",
    visible: true
  },
  {
    name: "1965",
    type: "arcgis",
    url: "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1965/MapServer",
    visible: true
  },
  {
    name: "1976",
    type: "arcgis",
    url: "https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1976/MapServer",
    visible: true
  },
  {
    name: "hillshade",
    type: "wms",
    url: "https://datacube.services.geo.ca/wrapper/ogc/elevation-hrdem-mosaic?service=WMS&layers=dtm-hillshade&format=image/png",
    visible: true
  },
  {
    name: "current",
    type: "arcgis",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    visible: true
  }
];

export async function ensureDefaultUserTilesets(prisma: PrismaClient, userId: string) {
  const initializedRows = await prisma.$queryRaw<Array<{ owner_id: string }>>(
    Prisma.sql`
      select owner_id
      from timetravelmap.user_tileset_profiles
      where owner_id = ${userId}
      limit 1
    `
  );

  if (initializedRows.length > 0) {
    return;
  }

  const existingRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>(
    Prisma.sql`
      select count(*)::bigint as count
      from timetravelmap.user_tilesets
      where owner_id = ${userId}
    `
  );

  const existingCount = Number(existingRows[0]?.count ?? 0);
  if (existingCount > 0) {
    await prisma.$executeRaw(
      Prisma.sql`
        insert into timetravelmap.user_tileset_profiles (owner_id)
        values (${userId})
        on conflict (owner_id) do nothing
      `
    );
    return;
  }

  await prisma.$transaction([
    prisma.$executeRaw(
      Prisma.sql`
        insert into timetravelmap.user_tileset_profiles (owner_id)
        values (${userId})
        on conflict (owner_id) do nothing
      `
    ),
    ...DEFAULT_USER_TILESETS.map((tileset, index) =>
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
            ${userId},
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
}
