import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { prepareImageUpload } from "./image-upload.ts";

async function fixture(width, height, format = "png") {
  return sharp({
    create: { width, height, channels: 4, background: { r: 20, g: 180, b: 230, alpha: 0.5 } }
  }).toFormat(format).toBuffer();
}

for (const [name, width, height, expectedWidth, expectedHeight] of [
  ["540p landscape", 3840, 2160, 960, 540],
  ["wide landscape", 4000, 2000, 960, 480],
  ["portrait", 2160, 3840, 304, 540],
  ["square", 2000, 2000, 540, 540],
  ["small image", 640, 480, 640, 480]
]) {
  test(name, async () => {
    const result = await prepareImageUpload(await fixture(width, height), "photo.png");
    const actual = await sharp(result.bytes).metadata();
    assert.equal(result.width, expectedWidth);
    assert.equal(result.height, expectedHeight);
    assert.equal(actual.width, expectedWidth);
    assert.equal(actual.height, expectedHeight);
    assert.ok(actual.hasAlpha);
    assert.ok(Math.abs(result.width / result.height - width / height) < 0.002);
  });
}

test("phone orientation is applied before resizing", async () => {
  const bytes = await sharp(await fixture(4000, 2000, "jpeg"))
    .withMetadata({ orientation: 6 }).toBuffer();
  const result = await prepareImageUpload(bytes, "phone.jpeg");
  const actual = await sharp(result.bytes).metadata();
  assert.equal(result.width, 270);
  assert.equal(result.height, 540);
  assert.equal(actual.orientation, undefined);
});

for (const format of ["jpeg", "png", "webp"]) {
  test(`keeps ${format} format and matches its filename and MIME type`, async () => {
    const result = await prepareImageUpload(await fixture(100, 50, format), "wrong-extension.bin");
    assert.equal((await sharp(result.bytes).metadata()).format, format);
    assert.equal(result.mimeType, `image/${format}`);
    assert.equal(result.fileName, `wrong-extension.${format === "jpeg" ? "jpg" : format}`);
  });
}

test("rejects invalid image bytes", async () => {
  await assert.rejects(prepareImageUpload(Buffer.from("not an image"), "image.png"));
});

test("animated images retain their frames and resize each frame", async () => {
  const first = await fixture(2000, 1200);
  const second = await sharp(first).negate().png().toBuffer();
  const bytes = await sharp([first, second], { join: { animated: true } }).gif().toBuffer();
  const result = await prepareImageUpload(bytes, "animation.gif");
  const actual = await sharp(result.bytes, { animated: true }).metadata();
  assert.equal(actual.pages, 2);
  assert.equal(actual.width, 900);
  assert.equal(actual.pageHeight, 540);
  assert.equal(result.height, 540);
});
