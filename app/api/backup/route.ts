import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getStackUser } from "../../../stack";
import { canAccessApp } from "../../../lib/access";
import { createBackupArchive } from "../../../lib/backup-archive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EventBackupRow = {
  id: string;
  owner_id: string | null;
  title: string;
  event_date: Date | string;
  area_m2: number | string | null;
  duration_minutes: number | null;
  device_used: string | null;
  device_mode: string | null;
  description: string | null;
  fill_color: string | null;
  outline_color: string | null;
  outline_width: number | string | null;
  source_file: string | null;
  source_placemark_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  geojson: string;
};

type FindBackupRow = {
  id: string;
  owner_id: string | null;
  event_id: string | null;
  title: string;
  find_date: Date | string;
  age_label: string | null;
  age_start_year: number | null;
  age_end_year: number | null;
  type: string;
  metal: string | null;
  item_count: number | null;
  description: string | null;
  latitude: number;
  longitude: number;
  source_file: string | null;
  source_placemark_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ProspectBackupRow = {
  id: string;
  owner_id: string | null;
  title: string;
  age_label: string | null;
  age_start_year: number | null;
  age_end_year: number | null;
  marker_color: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  date_visited: Date | string | null;
  source_file: string | null;
  source_placemark_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ImageBackupRow = {
  feature_kind: "event" | "find" | "prospect";
  feature_id: string;
  image_id: string;
  storage_path: string;
  original_url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  byte_size: bigint | number | string | null;
  alt_text: string | null;
  source_name: string | null;
  checksum_sha256: string | null;
  caption: string | null;
  sort_order: number;
  created_at: Date | string;
};

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function toIsoDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function toNumber(value: bigint | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildImageMap(rows: ImageBackupRow[]) {
  const imagesByFeature = new Map<string, ImageBackupRow[]>();

  for (const row of rows) {
    const key = `${row.feature_kind}:${row.feature_id}`;
    const images = imagesByFeature.get(key) ?? [];
    images.push(row);
    imagesByFeature.set(key, images);
  }

  return imagesByFeature;
}

function serializeImage(row: ImageBackupRow) {
  return {
    id: row.image_id,
    storagePath: row.storage_path,
    originalUrl: row.original_url,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    byteSize: toNumber(row.byte_size),
    altText: row.alt_text,
    sourceName: row.source_name,
    checksumSha256: row.checksum_sha256,
    caption: row.caption,
    sortOrder: row.sort_order,
    createdAt: toIsoDateTime(row.created_at)
  };
}

export async function GET(request: NextRequest) {
  const user = await getStackUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessApp(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const year = Number.parseInt(request.nextUrl.searchParams.get("year") ?? "", 10);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    return NextResponse.json({ error: "Missing or invalid year" }, { status: 400 });
  }

  const includeImages = request.nextUrl.searchParams.get("images") !== "false";
  const includeProspects = request.nextUrl.searchParams.get("prospects") === "true";
  const { prisma } = await import("../../../lib/prisma");

  const [events, finds, prospects] = await Promise.all([
    prisma.$queryRaw<EventBackupRow[]>`
      select
        id,
        owner_id,
        title,
        event_date,
        area_m2,
        duration_minutes,
        device_used,
        device_mode,
        description,
        fill_color,
        outline_color,
        outline_width,
        source_file,
        source_placemark_id,
        created_at,
        updated_at,
        ST_AsGeoJSON(area) as geojson
      from timetravelmap.events
      where extract(year from event_date)::int = ${year}
        and owner_id = ${user.id}
      order by event_date asc, title asc
    `,
    prisma.$queryRaw<FindBackupRow[]>`
      select
        id,
        owner_id,
        event_id,
        title,
        find_date,
        age_label,
        age_start_year,
        age_end_year,
        type,
        metal,
        item_count,
        description,
        latitude,
        longitude,
        source_file,
        source_placemark_id,
        created_at,
        updated_at
      from timetravelmap.finds
      where extract(year from find_date)::int = ${year}
        and owner_id = ${user.id}
      order by find_date asc, title asc
    `,
    includeProspects
      ? prisma.$queryRaw<ProspectBackupRow[]>`
          select
            id,
            owner_id,
            title,
            age_label,
            age_start_year,
            age_end_year,
            marker_color,
            description,
            latitude,
            longitude,
            date_visited,
            source_file,
            source_placemark_id,
            created_at,
            updated_at
          from timetravelmap.prospects
          where extract(year from date_visited)::int = ${year}
            and owner_id = ${user.id}
          order by date_visited asc nulls last, title asc
        `
      : Promise.resolve([])
  ]);

  const eventIds = events.map((event) => event.id);
  const findIds = finds.map((find) => find.id);
  const prospectIds = prospects.map((prospect) => prospect.id);

  const [eventImages, findImages, prospectImages] = includeImages
    ? await Promise.all([
        eventIds.length
          ? prisma.$queryRaw<ImageBackupRow[]>(
              Prisma.sql`
                select
                  'event'::text as feature_kind,
                  ei.event_id as feature_id,
                  i.id as image_id,
                  i.storage_path,
                  i.original_url,
                  i.mime_type,
                  i.width,
                  i.height,
                  i.byte_size,
                  i.alt_text,
                  i.source_name,
                  i.checksum_sha256,
                  ei.caption,
                  ei.sort_order,
                  i.created_at
                from timetravelmap.event_images ei
                join timetravelmap.images i on i.id = ei.image_id
                where ei.event_id in (${Prisma.join(eventIds)})
                order by ei.event_id, ei.sort_order, i.created_at
              `
            )
          : Promise.resolve([]),
        findIds.length
          ? prisma.$queryRaw<ImageBackupRow[]>(
              Prisma.sql`
                select
                  'find'::text as feature_kind,
                  fi.find_id as feature_id,
                  i.id as image_id,
                  i.storage_path,
                  i.original_url,
                  i.mime_type,
                  i.width,
                  i.height,
                  i.byte_size,
                  i.alt_text,
                  i.source_name,
                  i.checksum_sha256,
                  fi.caption,
                  fi.sort_order,
                  i.created_at
                from timetravelmap.find_images fi
                join timetravelmap.images i on i.id = fi.image_id
                where fi.find_id in (${Prisma.join(findIds)})
                order by fi.find_id, fi.sort_order, i.created_at
              `
            )
          : Promise.resolve([]),
        prospectIds.length
          ? prisma.$queryRaw<ImageBackupRow[]>(
              Prisma.sql`
                select
                  'prospect'::text as feature_kind,
                  pi.prospect_id as feature_id,
                  i.id as image_id,
                  i.storage_path,
                  i.original_url,
                  i.mime_type,
                  i.width,
                  i.height,
                  i.byte_size,
                  i.alt_text,
                  i.source_name,
                  i.checksum_sha256,
                  pi.caption,
                  pi.sort_order,
                  i.created_at
                from timetravelmap.prospect_images pi
                join timetravelmap.images i on i.id = pi.image_id
                where pi.prospect_id in (${Prisma.join(prospectIds)})
                order by pi.prospect_id, pi.sort_order, i.created_at
              `
            )
          : Promise.resolve([])
      ])
    : [[], [], []];

  const imagesByFeature = buildImageMap([...eventImages, ...findImages, ...prospectImages]);
  const payload = {
    exportedAt: new Date().toISOString(),
    ownerId: user.id,
    year,
    includes: {
      imageMetadata: includeImages,
      imageFiles: includeImages,
      datedProspects: includeProspects
    },
    counts: {
      events: events.length,
      finds: finds.length,
      prospects: prospects.length,
      images: eventImages.length + findImages.length + prospectImages.length
    },
    events: events.map((event) => ({
      id: event.id,
      ownerId: event.owner_id,
      title: event.title,
      eventDate: toIsoDate(event.event_date),
      areaM2: toNumber(event.area_m2),
      durationMinutes: event.duration_minutes,
      deviceUsed: event.device_used,
      deviceMode: event.device_mode,
      description: event.description,
      fillColor: event.fill_color,
      outlineColor: event.outline_color,
      outlineWidth: toNumber(event.outline_width),
      sourceFile: event.source_file,
      sourcePlacemarkId: event.source_placemark_id,
      createdAt: toIsoDateTime(event.created_at),
      updatedAt: toIsoDateTime(event.updated_at),
      geometry: JSON.parse(event.geojson),
      images: includeImages
        ? (imagesByFeature.get(`event:${event.id}`) ?? []).map(serializeImage)
        : []
    })),
    finds: finds.map((find) => ({
      id: find.id,
      ownerId: find.owner_id,
      eventId: find.event_id,
      title: find.title,
      findDate: toIsoDate(find.find_date),
      ageLabel: find.age_label,
      ageStartYear: find.age_start_year,
      ageEndYear: find.age_end_year,
      type: find.type,
      metal: find.metal,
      itemCount: find.item_count,
      description: find.description,
      latitude: find.latitude,
      longitude: find.longitude,
      sourceFile: find.source_file,
      sourcePlacemarkId: find.source_placemark_id,
      createdAt: toIsoDateTime(find.created_at),
      updatedAt: toIsoDateTime(find.updated_at),
      images: includeImages
        ? (imagesByFeature.get(`find:${find.id}`) ?? []).map(serializeImage)
        : []
    })),
    prospects: prospects.map((prospect) => ({
      id: prospect.id,
      ownerId: prospect.owner_id,
      title: prospect.title,
      ageLabel: prospect.age_label,
      ageStartYear: prospect.age_start_year,
      ageEndYear: prospect.age_end_year,
      markerColor: prospect.marker_color,
      description: prospect.description,
      latitude: prospect.latitude,
      longitude: prospect.longitude,
      dateVisited: toIsoDate(prospect.date_visited),
      sourceFile: prospect.source_file,
      sourcePlacemarkId: prospect.source_placemark_id,
      createdAt: toIsoDateTime(prospect.created_at),
      updatedAt: toIsoDateTime(prospect.updated_at),
      images: includeImages
        ? (imagesByFeature.get(`prospect:${prospect.id}`) ?? []).map(serializeImage)
        : []
    }))
  };

  if (includeImages) {
    const stream = createBackupArchive(
      [...eventImages, ...findImages, ...prospectImages],
      (imageFiles) => JSON.stringify({
        ...payload,
        imageFiles,
        imageBackupComplete: imageFiles.every((file) => !file.error),
        counts: {
          ...payload.counts,
          imageFiles: imageFiles.filter((file) => file.archivePath).length,
          missingImageFiles: imageFiles.filter((file) => file.error).length
        }
      }, null, 2),
      request.signal
    );
    return new NextResponse(stream, {
      headers: {
        "content-disposition": `attachment; filename="timetravelmap-${year}-backup.zip"`,
        "content-type": "application/zip",
        "cache-control": "private, no-store"
      }
    });
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-disposition": `attachment; filename="timetravelmap-${year}-backup.json"`,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store"
    }
  });
}
