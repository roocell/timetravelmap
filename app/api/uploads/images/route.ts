import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGES_ROOT = path.join(process.cwd(), "public", "images");

function extensionFor(fileName: string, mimeType: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext) {
    return ext;
  }

  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  return ".bin";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file upload" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 });
  }

  await fs.mkdir(IMAGES_ROOT, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const fileName = `${hash}${extensionFor(file.name, file.type)}`;
  const filePath = path.join(IMAGES_ROOT, fileName);

  await fs.writeFile(filePath, bytes);

  return NextResponse.json({
    src: `/images/${fileName}`,
    altText: file.name || null
  });
}
