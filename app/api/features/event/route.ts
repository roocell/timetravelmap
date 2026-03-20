import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EventRow = {
  id: string;
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

type ImageResultRow = {
  storage_path: string;
  alt_text: string | null;
  caption: string | null;
};

function toNullableString(value: unknown) {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function toNullableNumber(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePolygon(points: unknown) {
  if (!Array.isArray(points) || points.length < 3) {
    return null;
  }

  const ring = points
    .map((point) => {
      const latitude = Number((point as { lat?: unknown })?.lat);
      const longitude = Number((point as { lng?: unknown })?.lng);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      return [longitude, latitude];
    })
    .filter(Boolean) as number[][];

  if (ring.length < 3) {
    return null;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];

  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return {
    type: "Polygon",
    coordinates: [ring]
  };
}

export async function POST(request: NextRequest) {
  const { prisma } = await import("../../../../lib/prisma");

  try {
    const body = await request.json();
    const title = toNullableString(body?.title);
    const eventDate = toNullableString(body?.date ?? body?.eventDate);
    const geometry = normalizePolygon(body?.points);

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!eventDate) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (!geometry) {
      return NextResponse.json(
        { error: "At least three valid polygon points are required" },
        { status: 400 }
      );
    }

    const images = Array.isArray(body?.images) ? body.images : [];

    const rows = await prisma.$queryRaw<EventRow[]>(
      Prisma.sql`
        with inserted as (
          insert into timetravelmap.events (
            title,
            event_date,
            duration_minutes,
            device_used,
            device_mode,
            description,
            fill_color,
            outline_color,
            outline_width,
            area
          )
          values (
            ${title},
            ${eventDate}::date,
            ${toNullableNumber(body?.durationMinutes)},
            ${toNullableString(body?.deviceUsed)},
            ${toNullableString(body?.deviceMode)},
            ${toNullableString(body?.description)},
            ${toNullableString(body?.fillColor) ?? "#8cc9de"},
            ${toNullableString(body?.outlineColor) ?? "#f0c419"},
            3,
            ST_Multi(
              ST_CollectionExtract(
                ST_MakeValid(
                  ST_SetSRID(
                    ST_GeomFromGeoJSON(${JSON.stringify(geometry)}),
                    4326
                  )
                ),
                3
              )
            )
          )
          returning *
        )
        select
          id,
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
        from inserted
      `
    );

    const event = rows[0];
    if (!event) {
      return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }

    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      const src = toNullableString(image?.src);
      if (!src) {
        continue;
      }

      const storedImage = await prisma.image.upsert({
        where: { storagePath: src },
        update: {
          altText: toNullableString(image?.altText)
        },
        create: {
          storagePath: src,
          altText: toNullableString(image?.altText),
          sourceName: "manual-create"
        }
      });

      await prisma.eventImage.upsert({
        where: {
          eventId_imageId: {
            eventId: event.id,
            imageId: storedImage.id
          }
        },
        update: {
          sortOrder: index,
          caption: toNullableString(image?.caption)
        },
        create: {
          eventId: event.id,
          imageId: storedImage.id,
          sortOrder: index,
          caption: toNullableString(image?.caption)
        }
      });
    }

    const attachedImages = await prisma.$queryRaw<ImageResultRow[]>(
      Prisma.sql`
        select
          i.storage_path,
          i.alt_text,
          ei.caption
        from timetravelmap.event_images ei
        join timetravelmap.images i on i.id = ei.image_id
        where ei.event_id = ${event.id}::uuid
        order by ei.sort_order asc, i.created_at asc
      `
    );

    return NextResponse.json({
      event: {
        id: event.id,
        kind: "event",
        title: event.title,
        eventDate: String(event.event_date).slice(0, 10),
        durationMinutes: event.duration_minutes,
        deviceUsed: event.device_used,
        deviceMode: event.device_mode,
        description: event.description,
        fillColor: event.fill_color,
        outlineColor: event.outline_color,
        outlineWidth:
          event.outline_width === null ? null : Number(event.outline_width),
        geometry: JSON.parse(event.geojson),
        images: attachedImages.map((image) => ({
          src: image.storage_path,
          altText: image.alt_text,
          caption: image.caption
        }))
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create event"
      },
      { status: 500 }
    );
  }
}
