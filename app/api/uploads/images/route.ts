import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireStackUser, AuthRequiredError } from "../../../../lib/feature-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGES_ROOT = path.join(process.cwd(), "public", "images");

function extensionFor(fileName: string, mimeType: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext) {
    return ext;
  }

  if (mimeType === "image/heic") return ".heic";
  if (mimeType === "image/heif") return ".heif";
  if (mimeType === "image/avif") return ".avif";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpg") return ".jpg";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/bmp") return ".bmp";
  if (mimeType === "image/tiff") return ".tiff";
  if (mimeType === "image/svg+xml") return ".svg";
  return ".bin";
}

export async function POST(request: NextRequest) {
  const { prisma } = await import("../../../../lib/prisma");

  try {
    const user = await requireStackUser(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file upload" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const fileName = `${hash}${extensionFor(file.name, file.type)}`;
    const userDirectory = path.join(IMAGES_ROOT, user.id);
    const filePath = path.join(userDirectory, fileName);

    await fs.mkdir(userDirectory, { recursive: true });
    await fs.writeFile(filePath, bytes);

    const src = `/images/${user.id}/${fileName}`;

    await prisma.$executeRaw(
      Prisma.sql`
        insert into timetravelmap.images (
          owner_id,
          storage_path,
          alt_text,
          mime_type,
          byte_size,
          checksum_sha256,
          source_name
        )
        values (
          ${user.id},
          ${src},
          ${file.name || null},
          ${file.type || null},
          ${BigInt(bytes.byteLength)},
          ${hash},
          ${"stack-upload"}
        )
        on conflict (storage_path) do update
        set
          owner_id = excluded.owner_id,
          alt_text = excluded.alt_text,
          mime_type = excluded.mime_type,
          byte_size = excluded.byte_size,
          checksum_sha256 = excluded.checksum_sha256,
          source_name = excluded.source_name
      `
    );

    return NextResponse.json({
      src,
      altText: file.name || null
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload image" },
      { status: 500 }
    );
  }
}
