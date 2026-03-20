import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ImageResultRow = {
  storage_path: string;
  alt_text: string | null;
  caption: string | null;
};

type ProspectRow = {
  id: string;
  title: string;
  age_label: string | null;
  description: string | null;
  date_visited: Date | string | null;
  latitude: number;
  longitude: number;
};

function toNullableString(value: unknown) {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function normalizePoint(point: unknown) {
  const latitude = Number((point as { lat?: unknown })?.lat);
  const longitude = Number((point as { lng?: unknown })?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude
  };
}

export async function POST(request: NextRequest) {
  const { prisma } = await import("../../../../lib/prisma");

  try {
    const body = await request.json();
    const title = toNullableString(body?.title);
    const point = normalizePoint(body?.point);
    const images = Array.isArray(body?.images) ? body.images : [];

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!point) {
      return NextResponse.json({ error: "A valid map pin is required" }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<ProspectRow[]>(
      Prisma.sql`
        insert into timetravelmap.prospects (
          title,
          age_label,
          description,
          latitude,
          longitude,
          date_visited
        )
        values (
          ${title},
          ${toNullableString(body?.ageLabel)},
          ${toNullableString(body?.description)},
          ${point.latitude},
          ${point.longitude},
          ${toNullableString(body?.date) ? Prisma.sql`${toNullableString(body?.date)}::date` : Prisma.sql`null`}
        )
        returning
          id,
          title,
          age_label,
          description,
          date_visited,
          latitude,
          longitude
      `
    );

    const prospect = rows[0];
    if (!prospect) {
      return NextResponse.json({ error: "Failed to create prospect" }, { status: 500 });
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

      await prisma.prospectImage.upsert({
        where: {
          prospectId_imageId: {
            prospectId: prospect.id,
            imageId: storedImage.id
          }
        },
        update: {
          sortOrder: index,
          caption: toNullableString(image?.caption)
        },
        create: {
          prospectId: prospect.id,
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
          pi.caption
        from timetravelmap.prospect_images pi
        join timetravelmap.images i on i.id = pi.image_id
        where pi.prospect_id = ${prospect.id}::uuid
        order by pi.sort_order asc, i.created_at asc
      `
    );

    return NextResponse.json({
      prospect: {
        id: prospect.id,
        kind: "prospect",
        title: prospect.title,
        ageLabel: prospect.age_label,
        description: prospect.description,
        dateVisited: prospect.date_visited ? String(prospect.date_visited).slice(0, 10) : null,
        latitude: prospect.latitude,
        longitude: prospect.longitude,
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
        error: error instanceof Error ? error.message : "Failed to create prospect"
      },
      { status: 500 }
    );
  }
}
