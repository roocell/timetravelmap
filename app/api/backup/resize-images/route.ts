import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireStackUser, AuthRequiredError, AccessDeniedError } from "../../../../lib/feature-auth";
import { getSupabaseAdminClient } from "../../../../lib/supabase/admin-client";
import { IMAGE_BUCKET, getObjectPathFromStoredPath } from "../../../../lib/image-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const BATCH_SIZE = 3;

export async function POST(request: NextRequest) {
  try {
    const user = await requireStackUser(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      (body.cursor != null && (typeof body.cursor !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.cursor)))) {
      return NextResponse.json({ error: "Invalid image batch cursor" }, { status: 400 });
    }

    const { prisma } = await import("../../../../lib/prisma");
    const storage = getSupabaseAdminClient().storage.from(IMAGE_BUCKET);
    const prefix = storage.getPublicUrl("").data.publicUrl;
    const where = {
      ownerId: user.id,
      storagePath: { startsWith: prefix }
    };
    const [rows, total] = await Promise.all([
      prisma.image.findMany({
        where: { ...where, ...(body.cursor ? { id: { gt: body.cursor } } : {}) },
        select: { id: true, storagePath: true, altText: true, mimeType: true },
        orderBy: { id: "asc" },
        take: BATCH_SIZE + 1
      }),
      prisma.image.count({ where })
    ]);

    const images = rows.slice(0, BATCH_SIZE);
    const result = {
      total,
      processed: 0,
      resized: 0,
      skipped: 0,
      errors: [] as Array<{ id: string; name: string; error: string }>,
      nextCursor: rows.length > BATCH_SIZE ? images.at(-1)!.id : null
    };

    for (const image of images) {
      try {
        const { prepareImageUpload } = await import("../../../../lib/image-upload");
        const objectPath = getObjectPathFromStoredPath(image.storagePath);
        if (!objectPath) throw new Error("Invalid bucket image path");
        const { data, error } = await storage.download(objectPath);
        if (error || !data) throw new Error("Could not download image");
        const originalBytes = Buffer.from(await data.arrayBuffer());
        const resized = await prepareImageUpload(originalBytes, objectPath);
        const storedBytes = resized.resized ? resized.bytes : originalBytes;
        const mimeType = resized.resized ? resized.mimeType : data.type || image.mimeType || resized.mimeType;
        if (resized.resized) {
          const uploaded = await storage.upload(objectPath, storedBytes, {
            contentType: mimeType,
            cacheControl: "0",
            upsert: true
          });
          if (uploaded.error) throw new Error("Could not overwrite bucket image");
        }

        await prisma.image.update({
          where: { id: image.id, ownerId: user.id },
          data: {
            width: resized.width,
            height: resized.height,
            byteSize: BigInt(storedBytes.byteLength),
            mimeType,
            checksumSha256: createHash("sha256").update(storedBytes).digest("hex")
          }
        });
        if (resized.resized) result.resized += 1;
        else result.skipped += 1;
      } catch (error) {
        console.error("Bucket image resize failed", { imageId: image.id, error });
        result.errors.push({
          id: image.id,
          name: image.altText || image.id,
          error: error instanceof Error ? error.message : "Image resize failed"
        });
      }
      result.processed += 1;
    }

    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (!(error instanceof AuthRequiredError) && !(error instanceof AccessDeniedError)) {
      console.error("Bucket resize request failed", error);
    }
    const status = error instanceof AuthRequiredError ? 401 : error instanceof AccessDeniedError ? 403 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bucket resize failed" }, { status });
  }
}
