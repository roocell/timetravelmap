import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  AuthRequiredError,
  ensureImageOwnedByUser,
  FeatureOwnershipError,
  requireStackUser
} from "../../../../lib/feature-auth";

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
  marker_color: string | null;
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
    const user = await requireStackUser(request);
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
          owner_id,
          age_label,
          marker_color,
          description,
          latitude,
          longitude,
          date_visited
        )
        values (
          ${title},
          ${user.id},
          ${toNullableString(body?.ageLabel)},
          ${toNullableString(body?.markerColor) ?? "#f0c419"},
          ${toNullableString(body?.description)},
          ${point.latitude},
          ${point.longitude},
          ${toNullableString(body?.date) ? Prisma.sql`${toNullableString(body?.date)}::date` : Prisma.sql`null`}
        )
        returning
          id,
          title,
          age_label,
          marker_color,
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

      const storedImage = await ensureImageOwnedByUser(prisma, src, user.id);

      await prisma.image.update({
        where: { id: storedImage.id },
        data: {
          altText: toNullableString(image?.altText)
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
        ownerId: user.id,
        title: prospect.title,
        ageLabel: prospect.age_label,
        markerColor: prospect.marker_color,
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
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof FeatureOwnershipError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create prospect"
      },
      { status: 500 }
    );
  }
}
