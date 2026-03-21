import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getStackUser } from "../../../../stack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ImageRow = {
  owner_id: string;
  storage_path: string;
  alt_text: string | null;
  caption: string | null;
  sort_order: number;
};

type EventRow = {
  id: string;
  owner_id: string | null;
  title: string;
  event_date: Date | string;
  duration_minutes: number | null;
  device_used: string | null;
  device_mode: string | null;
  description: string | null;
  fill_color: string | null;
  outline_color: string | null;
  outline_width: number | string | null;
  geojson: string;
};

type FindRow = {
  id: string;
  owner_id: string | null;
  title: string;
  find_date: Date | string;
  description: string | null;
  age_label: string | null;
  type: string;
  metal: string | null;
  item_count: number | null;
  latitude: number;
  longitude: number;
};

type ProspectRow = {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  age_label: string | null;
  date_visited: Date | string | null;
  latitude: number;
  longitude: number;
};

function buildImageMap(rows: ImageRow[]) {
  const imagesByOwner = new Map<string, Array<{
    src: string;
    altText: string | null;
    caption: string | null;
  }>>();

  for (const row of rows) {
    const images = imagesByOwner.get(row.owner_id) ?? [];
    images.push({
      src: row.storage_path,
      altText: row.alt_text,
      caption: row.caption
    });
    imagesByOwner.set(row.owner_id, images);
  }

  return imagesByOwner;
}

export async function GET(request: NextRequest) {
  const user = await getStackUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prisma } = await import("../../../../lib/prisma");
  const yearParam = request.nextUrl.searchParams.get("year");
  const dataset = request.nextUrl.searchParams.get("dataset");

  if (dataset === "prospects") {
    const prospects = await prisma.$queryRaw<ProspectRow[]>`
      select
        id,
        owner_id,
        title,
        description,
        age_label,
        date_visited,
        latitude,
        longitude
      from timetravelmap.prospects
      where owner_id = ${user.id}
      order by title asc
    `;

    const prospectIds = prospects.map((prospect) => prospect.id);
    const prospectImages = prospectIds.length
      ? await prisma.$queryRaw<ImageRow[]>(
          Prisma.sql`
            select
              pi.prospect_id as owner_id,
              i.storage_path,
              i.alt_text,
              pi.caption,
              pi.sort_order
            from timetravelmap.prospect_images pi
            join timetravelmap.images i on i.id = pi.image_id
            where pi.prospect_id in (${Prisma.join(prospectIds)})
            order by pi.prospect_id, pi.sort_order, i.created_at
          `
        )
      : [];
    const prospectImagesById = buildImageMap(prospectImages);

    return NextResponse.json({
      type: "prospects",
      prospects: prospects.map((prospect) => ({
        id: prospect.id,
        ownerId: prospect.owner_id,
        title: prospect.title,
        description: prospect.description,
        ageLabel: prospect.age_label,
        dateVisited: prospect.date_visited,
        latitude: prospect.latitude,
        longitude: prospect.longitude,
        images: prospectImagesById.get(prospect.id) ?? []
      }))
    });
  }

  const year = Number.parseInt(yearParam ?? "", 10);
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "Missing or invalid year" }, { status: 400 });
  }

  const [events, finds] = await Promise.all([
    prisma.$queryRaw<EventRow[]>`
      select
        id,
        owner_id,
        title,
        event_date,
        duration_minutes,
        device_used,
        device_mode,
        description,
        fill_color,
        outline_color,
        outline_width,
        ST_AsGeoJSON(area) as geojson
      from timetravelmap.events
      where extract(year from event_date)::int = ${year}
        and owner_id = ${user.id}
      order by event_date asc, title asc
    `,
    prisma.$queryRaw<FindRow[]>`
      select
        id,
        owner_id,
        title,
        find_date,
        description,
        age_label,
        type,
        metal,
        item_count,
        latitude,
        longitude
      from timetravelmap.finds
      where extract(year from find_date)::int = ${year}
        and owner_id = ${user.id}
      order by find_date asc, title asc
    `
  ]);

  const eventIds = events.map((event) => event.id);
  const findIds = finds.map((find) => find.id);

  const [eventImages, findImages] = await Promise.all([
    eventIds.length
      ? prisma.$queryRaw<ImageRow[]>(
          Prisma.sql`
            select
              ei.event_id as owner_id,
              i.storage_path,
              i.alt_text,
              ei.caption,
              ei.sort_order
            from timetravelmap.event_images ei
            join timetravelmap.images i on i.id = ei.image_id
            where ei.event_id in (${Prisma.join(eventIds)})
            order by ei.event_id, ei.sort_order, i.created_at
          `
        )
      : Promise.resolve([]),
    findIds.length
      ? prisma.$queryRaw<ImageRow[]>(
          Prisma.sql`
            select
              fi.find_id as owner_id,
              i.storage_path,
              i.alt_text,
              fi.caption,
              fi.sort_order
            from timetravelmap.find_images fi
            join timetravelmap.images i on i.id = fi.image_id
            where fi.find_id in (${Prisma.join(findIds)})
            order by fi.find_id, fi.sort_order, i.created_at
          `
        )
      : Promise.resolve([])
  ]);

  const eventImagesById = buildImageMap(eventImages);
  const findImagesById = buildImageMap(findImages);

  return NextResponse.json({
    type: "year",
    year,
    events: events.map((event) => ({
      id: event.id,
      ownerId: event.owner_id,
      title: event.title,
      eventDate: event.event_date,
      durationMinutes: event.duration_minutes,
      deviceUsed: event.device_used,
      deviceMode: event.device_mode,
      description: event.description,
      fillColor: event.fill_color,
      outlineColor: event.outline_color,
      outlineWidth:
        event.outline_width === null ? null : Number(event.outline_width),
      geometry: JSON.parse(event.geojson),
      images: eventImagesById.get(event.id) ?? []
    })),
    finds: finds.map((find) => ({
      id: find.id,
      ownerId: find.owner_id,
      title: find.title,
      findDate: find.find_date,
      description: find.description,
      ageLabel: find.age_label,
      type: find.type,
      metal: find.metal,
      itemCount: find.item_count,
      latitude: find.latitude,
      longitude: find.longitude,
      images: findImagesById.get(find.id) ?? []
    }))
  });
}
