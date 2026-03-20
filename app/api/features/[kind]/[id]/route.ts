import fs from "node:fs/promises";
import path from "node:path";
import { FindType, MetalCode, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FeatureKind = "event" | "find" | "prospect";

type FeatureImage = {
  src: string;
  altText: string | null;
  caption: string | null;
};

const PUBLIC_ROOT = path.join(process.cwd(), "public");

function isFeatureKind(value: string): value is FeatureKind {
  return value === "event" || value === "find" || value === "prospect";
}

function toDate(value: unknown) {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  return new Date(`${text}T00:00:00.000Z`);
}

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
    ? (normalized as FindType)
    : null;
}

function toMetalCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return Object.values(MetalCode).includes(normalized as MetalCode)
    ? (normalized as MetalCode)
    : null;
}

function serializeImages(
  rows: Array<{ image: { storagePath: string; altText: string | null }; caption: string | null }>
): FeatureImage[] {
  return rows.map((row) => ({
    src: row.image.storagePath,
    altText: row.image.altText,
    caption: row.caption
  }));
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
  if (!first || !last) {
    return null;
  }

  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return {
    type: "Polygon",
    coordinates: [ring]
  };
}

async function readFeature(prisma: Awaited<typeof import("../../../../../lib/prisma")>["prisma"], kind: FeatureKind, id: string) {
  if (kind === "event") {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        eventImages: {
          orderBy: { sortOrder: "asc" },
          include: {
            image: {
              select: {
                storagePath: true,
                altText: true
              }
            }
          }
        }
      }
    });

    if (!event) {
      return null;
    }

    return {
      id: event.id,
      kind,
      title: event.title,
      description: event.description,
      eventDate: event.eventDate.toISOString().slice(0, 10),
      durationMinutes: event.durationMinutes,
      deviceUsed: event.deviceUsed,
      deviceMode: event.deviceMode,
      images: serializeImages(event.eventImages)
    };
  }

  if (kind === "find") {
    const find = await prisma.find.findUnique({
      where: { id },
      include: {
        findImages: {
          orderBy: { sortOrder: "asc" },
          include: {
            image: {
              select: {
                storagePath: true,
                altText: true
              }
            }
          }
        }
      }
    });

    if (!find) {
      return null;
    }

    return {
      id: find.id,
      kind,
      title: find.title,
      description: find.description,
      findDate: find.findDate.toISOString().slice(0, 10),
      ageLabel: find.ageLabel,
      type: find.type,
      metal: find.metal,
      itemCount: find.itemCount,
      images: serializeImages(find.findImages)
    };
  }

  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: {
      prospectImages: {
        orderBy: { sortOrder: "asc" },
        include: {
          image: {
            select: {
              storagePath: true,
              altText: true
            }
          }
        }
      }
    }
  });

  if (!prospect) {
    return null;
  }

  return {
    id: prospect.id,
    kind,
    title: prospect.title,
    description: prospect.description,
    ageLabel: prospect.ageLabel,
    dateVisited: prospect.dateVisited?.toISOString().slice(0, 10) ?? null,
    images: serializeImages(prospect.prospectImages)
  };
}

async function addImage(
  prisma: Awaited<typeof import("../../../../../lib/prisma")>["prisma"],
  kind: FeatureKind,
  id: string,
  payload: { src: string; altText?: string | null; caption?: string | null }
) {
  const src = toNullableString(payload.src);
  if (!src) {
    throw new Error("Image path is required");
  }

  const image = await prisma.image.upsert({
    where: { storagePath: src },
    update: {
      altText: toNullableString(payload.altText)
    },
    create: {
      storagePath: src,
      altText: toNullableString(payload.altText),
      sourceName: "manual-edit"
    }
  });

  if (kind === "event") {
    const currentMax = await prisma.eventImage.aggregate({
      where: { eventId: id },
      _max: { sortOrder: true }
    });

    await prisma.eventImage.upsert({
      where: {
        eventId_imageId: {
          eventId: id,
          imageId: image.id
        }
      },
      update: {
        caption: toNullableString(payload.caption)
      },
      create: {
        eventId: id,
        imageId: image.id,
        sortOrder: (currentMax._max.sortOrder ?? -1) + 1,
        caption: toNullableString(payload.caption)
      }
    });
    return;
  }

  if (kind === "find") {
    const currentMax = await prisma.findImage.aggregate({
      where: { findId: id },
      _max: { sortOrder: true }
    });

    await prisma.findImage.upsert({
      where: {
        findId_imageId: {
          findId: id,
          imageId: image.id
        }
      },
      update: {
        caption: toNullableString(payload.caption)
      },
      create: {
        findId: id,
        imageId: image.id,
        sortOrder: (currentMax._max.sortOrder ?? -1) + 1,
        caption: toNullableString(payload.caption)
      }
    });
    return;
  }

  const currentMax = await prisma.prospectImage.aggregate({
    where: { prospectId: id },
    _max: { sortOrder: true }
  });

  await prisma.prospectImage.upsert({
    where: {
      prospectId_imageId: {
        prospectId: id,
        imageId: image.id
      }
    },
    update: {
      caption: toNullableString(payload.caption)
    },
    create: {
      prospectId: id,
      imageId: image.id,
      sortOrder: (currentMax._max.sortOrder ?? -1) + 1,
      caption: toNullableString(payload.caption)
    }
  });
}

async function removeImage(
  prisma: Awaited<typeof import("../../../../../lib/prisma")>["prisma"],
  kind: FeatureKind,
  id: string,
  src: string
) {
  const image = await prisma.image.findUnique({
    where: { storagePath: src },
    select: {
      id: true,
      storagePath: true
    }
  });

  if (!image) {
    return;
  }

  if (kind === "event") {
    await prisma.eventImage.deleteMany({
      where: {
        eventId: id,
        imageId: image.id
      }
    });
  } else if (kind === "find") {
    await prisma.findImage.deleteMany({
      where: {
        findId: id,
        imageId: image.id
      }
    });
  } else {
    await prisma.prospectImage.deleteMany({
      where: {
        prospectId: id,
        imageId: image.id
      }
    });
  }

  const [eventRefs, findRefs, prospectRefs] = await Promise.all([
    prisma.eventImage.count({
      where: { imageId: image.id }
    }),
    prisma.findImage.count({
      where: { imageId: image.id }
    }),
    prisma.prospectImage.count({
      where: { imageId: image.id }
    })
  ]);

  if (eventRefs + findRefs + prospectRefs > 0) {
    return;
  }

  await prisma.image.delete({
    where: { id: image.id }
  });

  const relativePath = image.storagePath.replace(/^\/+/, "");
  const filePath = path.join(PUBLIC_ROOT, relativePath);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(PUBLIC_ROOT + path.sep) && resolvedPath !== PUBLIC_ROOT) {
    throw new Error("Refusing to delete file outside public directory");
  }

  await fs.unlink(resolvedPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ kind: string; id: string }> }
) {
  const { prisma } = await import("../../../../../lib/prisma");
  const { kind: rawKind, id } = await context.params;

  if (!isFeatureKind(rawKind)) {
    return NextResponse.json({ error: "Invalid feature kind" }, { status: 400 });
  }

  const body = await request.json();

  try {
    if (rawKind === "event") {
      const data: Record<string, unknown> = {};

      if ("title" in body) data.title = String(body.title ?? "").trim();
      if ("description" in body) data.description = toNullableString(body.description);
      if ("eventDate" in body) data.eventDate = toDate(body.eventDate);
      if ("durationMinutes" in body) data.durationMinutes = toNullableNumber(body.durationMinutes);
      if ("deviceUsed" in body) data.deviceUsed = toNullableString(body.deviceUsed);
      if ("deviceMode" in body) data.deviceMode = toNullableString(body.deviceMode);

      if (Object.keys(data).length > 0) {
        await prisma.event.update({
          where: { id },
          data
        });
      }

      if ("points" in body) {
        const geometry = normalizePolygon(body.points);
        if (!geometry) {
          throw new Error("A valid polygon is required");
        }

        await prisma.$executeRaw(
          Prisma.sql`
            update timetravelmap.events
            set area = ST_Multi(
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
            where id = ${id}::uuid
          `
        );
      }
    }

    if (rawKind === "find") {
      const data: Record<string, unknown> = {};

      if ("title" in body) data.title = String(body.title ?? "").trim();
      if ("description" in body) data.description = toNullableString(body.description);
      if ("findDate" in body) data.findDate = toDate(body.findDate);
      if ("ageLabel" in body) data.ageLabel = toNullableString(body.ageLabel);
      if ("type" in body) data.type = toFindType(body.type) ?? FindType.other;
      if ("metal" in body) data.metal = body.metal ? toMetalCode(body.metal) : null;
      if ("itemCount" in body) data.itemCount = toNullableNumber(body.itemCount);
      if ("latitude" in body) data.latitude = toNullableNumber(body.latitude);
      if ("longitude" in body) data.longitude = toNullableNumber(body.longitude);

      if (Object.keys(data).length > 0) {
        await prisma.find.update({
          where: { id },
          data
        });
      }
    }

    if (rawKind === "prospect") {
      const data: Record<string, unknown> = {};

      if ("title" in body) data.title = String(body.title ?? "").trim();
      if ("description" in body) data.description = toNullableString(body.description);
      if ("ageLabel" in body) data.ageLabel = toNullableString(body.ageLabel);
      if ("dateVisited" in body) data.dateVisited = toDate(body.dateVisited);
      if ("latitude" in body) data.latitude = toNullableNumber(body.latitude);
      if ("longitude" in body) data.longitude = toNullableNumber(body.longitude);

      if (Object.keys(data).length > 0) {
        await prisma.prospect.update({
          where: { id },
          data
        });
      }
    }

    if (body.addImage) {
      await addImage(prisma, rawKind, id, body.addImage);
    }

    if (body.removeImageSrc) {
      await removeImage(prisma, rawKind, id, String(body.removeImageSrc));
    }

    const feature = await readFeature(prisma, rawKind, id);
    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    return NextResponse.json({ feature });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update feature";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function cleanupOrphanedImage(
  prisma: Awaited<typeof import("../../../../../lib/prisma")>["prisma"],
  image: { id: string; storagePath: string }
) {
  const [eventRefs, findRefs, prospectRefs] = await Promise.all([
    prisma.eventImage.count({
      where: { imageId: image.id }
    }),
    prisma.findImage.count({
      where: { imageId: image.id }
    }),
    prisma.prospectImage.count({
      where: { imageId: image.id }
    })
  ]);

  if (eventRefs + findRefs + prospectRefs > 0) {
    return;
  }

  await prisma.image.delete({
    where: { id: image.id }
  });

  const relativePath = image.storagePath.replace(/^\/+/, "");
  const filePath = path.join(PUBLIC_ROOT, relativePath);
  const resolvedPath = path.resolve(filePath);

  if (!resolvedPath.startsWith(PUBLIC_ROOT + path.sep) && resolvedPath !== PUBLIC_ROOT) {
    throw new Error("Refusing to delete file outside public directory");
  }

  await fs.unlink(resolvedPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ kind: string; id: string }> }
) {
  const { prisma } = await import("../../../../../lib/prisma");
  const { kind: rawKind, id } = await context.params;

  if (!isFeatureKind(rawKind)) {
    return NextResponse.json({ error: "Invalid feature kind" }, { status: 400 });
  }

  try {
    const images =
      rawKind === "event"
        ? await prisma.eventImage.findMany({
            where: { eventId: id },
            select: { image: { select: { id: true, storagePath: true } } }
          })
        : rawKind === "find"
          ? await prisma.findImage.findMany({
              where: { findId: id },
              select: { image: { select: { id: true, storagePath: true } } }
            })
          : await prisma.prospectImage.findMany({
              where: { prospectId: id },
              select: { image: { select: { id: true, storagePath: true } } }
            });

    if (rawKind === "event") {
      await prisma.event.delete({
        where: { id }
      });
    } else if (rawKind === "find") {
      await prisma.find.delete({
        where: { id }
      });
    } else {
      await prisma.prospect.delete({
        where: { id }
      });
    }

    for (const entry of images) {
      await cleanupOrphanedImage(prisma, entry.image);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete feature";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
