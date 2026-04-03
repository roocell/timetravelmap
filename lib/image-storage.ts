import { Buffer } from "node:buffer";
import path from "node:path";
import crypto from "node:crypto";
import { getSupabaseAdminClient } from "./supabase/admin-client";

export const IMAGE_BUCKET = process.env.SUPABASE_IMAGE_BUCKET || "images";

export function extensionFor(fileName: string, mimeType: string) {
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

export function createImageObjectPath(ownerId: string, fileName: string, mimeType: string, bytes: Buffer) {
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  return {
    hash,
    objectPath: `${ownerId}/${hash}${extensionFor(fileName, mimeType)}`
  };
}

export function getPublicImageUrl(objectPath: string) {
  const admin = getSupabaseAdminClient();
  const { data } = admin.storage.from(IMAGE_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function uploadImageToStorage(params: {
  ownerId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  const { ownerId, fileName, mimeType, bytes } = params;
  const admin = getSupabaseAdminClient();
  const { hash, objectPath } = createImageObjectPath(ownerId, fileName, mimeType, bytes);

  const { error } = await admin.storage.from(IMAGE_BUCKET).upload(objectPath, bytes, {
    contentType: mimeType || "application/octet-stream",
    upsert: true
  });

  if (error) {
    throw new Error(`Failed to upload image to storage: ${error.message}`);
  }

  return {
    hash,
    objectPath,
    publicUrl: getPublicImageUrl(objectPath)
  };
}

export function getObjectPathFromStoredPath(src: string) {
  if (!src) {
    return null;
  }

  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const markerIndex = src.indexOf(marker);
  if (markerIndex >= 0) {
    return src.slice(markerIndex + marker.length);
  }

  const legacyPrefix = "/images/";
  if (src.startsWith(legacyPrefix)) {
    return null;
  }

  return src.replace(/^\/+/, "");
}

export async function removeStoredImage(src: string) {
  const objectPath = getObjectPathFromStoredPath(src);
  if (!objectPath) {
    return false;
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage.from(IMAGE_BUCKET).remove([objectPath]);
  if (error) {
    throw new Error(`Failed to remove image from storage: ${error.message}`);
  }

  return true;
}
