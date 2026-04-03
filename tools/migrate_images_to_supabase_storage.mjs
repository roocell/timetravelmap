#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import pkg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pkg;
const IMAGE_BUCKET = process.env.SUPABASE_IMAGE_BUCKET || "images";
const PUBLIC_ROOT = path.join(process.cwd(), "public");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function extensionFor(fileName, mimeType) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext) return ext;
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

function getPublicUrl(supabase, objectPath) {
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const client = new Client({ connectionString: databaseUrl });
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  await client.connect();

  const { rows } = await client.query(`
    select id, owner_id, storage_path, mime_type, alt_text
    from timetravelmap.images
    order by created_at asc
  `);

  let migrated = 0;
  let skipped = 0;
  let missing = 0;
  let failed = 0;

  for (const row of rows) {
    const storagePath = String(row.storage_path || "");
    if (storagePath.includes(`/storage/v1/object/public/${IMAGE_BUCKET}/`)) {
      skipped += 1;
      continue;
    }

    if (!storagePath.startsWith("/images/")) {
      skipped += 1;
      continue;
    }

    const relativePath = storagePath.replace(/^\/+/, "");
    const absolutePath = path.join(PUBLIC_ROOT, relativePath);

    let bytes;
    try {
      bytes = await fs.readFile(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        missing += 1;
        console.warn(`Missing file for ${row.id}: ${absolutePath}`);
        continue;
      }
      failed += 1;
      console.error(`Failed reading ${absolutePath}:`, error);
      continue;
    }

    try {
      const ownerId = row.owner_id || "unowned";
      const hash = crypto.createHash("sha256").update(bytes).digest("hex");
      const objectPath = `${ownerId}/${hash}${extensionFor(storagePath, row.mime_type || "")}`;

      const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(objectPath, bytes, {
        contentType: row.mime_type || "application/octet-stream",
        upsert: true
      });

      if (uploadError) {
        throw uploadError;
      }

      const publicUrl = getPublicUrl(supabase, objectPath);

      await client.query(
        `
          update timetravelmap.images
          set storage_path = $1,
              checksum_sha256 = coalesce(checksum_sha256, $2),
              byte_size = coalesce(byte_size, $3)
          where id = $4
        `,
        [publicUrl, hash, String(bytes.byteLength), row.id]
      );

      migrated += 1;
      console.log(`Migrated ${row.id} -> ${objectPath}`);
    } catch (error) {
      failed += 1;
      console.error(`Failed migrating ${row.id}:`, error);
    }
  }

  await client.end();

  console.log("\nMigration complete");
  console.log(JSON.stringify({ bucket: IMAGE_BUCKET, migrated, skipped, missing, failed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
