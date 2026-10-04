import { ZipArchive } from "archiver";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { once } from "node:events";
import { extensionFor, getObjectPathFromStoredPath, IMAGE_BUCKET } from "./image-storage";
import { getSupabaseAdminClient } from "./supabase/admin-client";

type BackupImage = {
  image_id: string;
  storage_path: string;
  mime_type: string | null;
};

type ImageFileResult = {
  id: string;
  archivePath: string | null;
  error?: string;
};

async function readImage(image: BackupImage, publicRoot: string) {
  if (image.storage_path.startsWith("/images/")) {
    const filePath = path.resolve(publicRoot, `.${image.storage_path}`);
    const imagesRoot = path.resolve(publicRoot, "images") + path.sep;
    if (!filePath.startsWith(imagesRoot)) {
      throw new Error("Invalid image path");
    }
    return readFile(filePath);
  }

  const objectPath = getObjectPathFromStoredPath(image.storage_path);
  if (!objectPath) throw new Error("Invalid image storage path");
  const { data, error } = await getSupabaseAdminClient()
    .storage.from(IMAGE_BUCKET).download(objectPath);
  if (error || !data) throw new Error("Image could not be downloaded from storage");
  return Buffer.from(await data.arrayBuffer());
}

export function createBackupArchive(
  images: BackupImage[],
  serialize: (files: ImageFileResult[]) => string,
  signal: AbortSignal,
  publicRoot = path.join(process.cwd(), "public")
) {
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const output = new PassThrough();
  const cancel = () => {
    archive.abort();
    output.destroy();
  };
  const fail = (error: Error) => {
    output.destroy(error);
    archive.abort();
  };
  archive.on("error", fail);
  archive.on("warning", fail);
  output.on("close", () => {
    signal.removeEventListener("abort", cancel);
    archive.abort();
  });
  signal.addEventListener("abort", cancel, { once: true });
  archive.pipe(output);

  // Process one image at a time so large yearly backups do not accumulate in memory.
  void (async () => {
    const files: ImageFileResult[] = [];
    const uniqueImages = new Map(images.map((image) => [image.image_id, image]));
    for (const image of uniqueImages.values()) {
      if (signal.aborted || output.destroyed) return;
      let bytes: Buffer;
      try {
        bytes = await readImage(image, publicRoot);
      } catch {
        files.push({ id: image.image_id, archivePath: null, error: "Image file is unavailable" });
        continue;
      }
      const ext = extensionFor(image.storage_path, image.mime_type ?? "");
      const safeExt = /^\.[a-z0-9]{1,10}$/i.test(ext) ? ext : ".bin";
      const name = `images/${image.image_id}${safeExt}`;
      const entered = once(archive, "entry");
      archive.append(bytes, { name, store: true });
      await entered;
      files.push({ id: image.image_id, archivePath: name });
    }

    archive.append(serialize(files), { name: "backup.json" });
    const missing = files.filter((file) => file.error);
    if (missing.length) {
      archive.append(JSON.stringify({
        error: "This backup is incomplete: some image files are unavailable.",
        missingImages: missing
      }, null, 2), { name: "MISSING-IMAGES.json" });
    }
    await archive.finalize();
  })().catch(fail);

  if (signal.aborted) cancel();
  return Readable.toWeb(output) as ReadableStream<Uint8Array>;
}
