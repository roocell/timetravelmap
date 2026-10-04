import sharp from "sharp";
import path from "node:path";

export async function prepareImageUpload(bytes: Buffer, fileName: string) {
  const image = sharp(bytes, { animated: true });
  const metadata = await image.metadata();
  const format = metadata.format;
  const outputFormat = format === "jpeg" || format === "png" || format === "webp" ||
    format === "gif" || format === "tiff"
    ? format
    : format === "heif" && metadata.compression === "av1" ? "avif" : "png";
  const { data, info } = await image
    .autoOrient()
    .resize({ width: 960, height: 540, fit: "inside", withoutEnlargement: true })
    .toFormat(outputFormat)
    .toBuffer({ resolveWithObject: true });
  const extension = outputFormat === "jpeg" ? "jpg" : outputFormat;

  return {
    bytes: data,
    fileName: `${path.parse(fileName).name || "image"}.${extension}`,
    mimeType: `image/${outputFormat}`,
    width: info.width,
    height: info.pageHeight ?? info.height
  };
}
