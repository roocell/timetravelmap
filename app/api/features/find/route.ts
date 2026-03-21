import { FindType, MetalCode, Prisma } from "@prisma/client";
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

type FindRow = {
  id: string;
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

function toFindType(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return Object.values(FindType).includes(normalized as FindType)
    ? normalized
    : "other";
}

function toMetalCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return Object.values(MetalCode).includes(normalized as MetalCode) ? normalized : null;
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
    const findDate = toNullableString(body?.date);
    const point = normalizePoint(body?.point);

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!findDate) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    if (!point) {
      return NextResponse.json({ error: "A valid map pin is required" }, { status: 400 });
    }

    const images = Array.isArray(body?.images) ? body.images : [];

    const rows = await prisma.$queryRaw<FindRow[]>(
      Prisma.sql`
        insert into timetravelmap.finds (
          title,
          owner_id,
          find_date,
          age_label,
          type,
          metal,
          item_count,
          description,
          latitude,
          longitude
        )
        values (
          ${title},
          ${user.id},
          ${findDate}::date,
          ${toNullableString(body?.ageLabel)},
          CAST(${toFindType(body?.type)} AS timetravelmap.find_type),
          CAST(${toMetalCode(body?.metal)} AS timetravelmap.metal_code),
          ${toNullableNumber(body?.itemCount)},
          ${toNullableString(body?.description)},
          ${point.latitude},
          ${point.longitude}
        )
        returning
          id,
          title,
          find_date,
          description,
          age_label,
          type::text,
          metal::text,
          item_count,
          latitude,
          longitude
      `
    );

    const find = rows[0];
    if (!find) {
      return NextResponse.json({ error: "Failed to create find" }, { status: 500 });
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

      await prisma.findImage.upsert({
        where: {
          findId_imageId: {
            findId: find.id,
            imageId: storedImage.id
          }
        },
        update: {
          sortOrder: index,
          caption: toNullableString(image?.caption)
        },
        create: {
          findId: find.id,
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
          fi.caption
        from timetravelmap.find_images fi
        join timetravelmap.images i on i.id = fi.image_id
        where fi.find_id = ${find.id}::uuid
        order by fi.sort_order asc, i.created_at asc
      `
    );

    return NextResponse.json({
      find: {
        id: find.id,
        kind: "find",
        ownerId: user.id,
        title: find.title,
        findDate: String(find.find_date).slice(0, 10),
        ageLabel: find.age_label,
        type: find.type,
        metal: find.metal,
        itemCount: find.item_count,
        description: find.description,
        latitude: find.latitude,
        longitude: find.longitude,
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
        error: error instanceof Error ? error.message : "Failed to create find"
      },
      { status: 500 }
    );
  }
}
