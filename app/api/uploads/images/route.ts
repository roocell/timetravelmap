import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireStackUser, AuthRequiredError } from "../../../../lib/feature-auth";
import { uploadImageToStorage } from "../../../../lib/image-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const uploaded = await uploadImageToStorage({
      ownerId: user.id,
      fileName: file.name,
      mimeType: file.type,
      bytes
    });

    const src = uploaded.publicUrl;

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
          ${uploaded.hash},
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
