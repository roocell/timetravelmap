import { readFile } from "node:fs/promises";
import path from "node:path";

const DATA_ROOT = path.join(process.cwd(), "static", "data");
const EMPTY_TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAAA3NCSVQICAjb4U/gAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJ" +
    "bWFnZVJlYWR5ccllPAAAAAxJREFUeNrswQENAAAAwqD3T20ON6AAAAAAAAAAAAAAAAAAAAAA4NcAAS4AAS4AAbwAAAAASUVO" +
    "RK5CYII=",
  "base64"
);

export async function GET(_request, { params }) {
  const { layer, z, x, y } = await params;
  const safeY = y.endsWith(".png") ? y : `${y}.png`;
  const filePath = path.join(DATA_ROOT, layer, z, x, safeY);
  const relativePath = path.relative(DATA_ROOT, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const buffer = await readFile(filePath);

    return new Response(buffer, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return new Response(EMPTY_TILE, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=60"
      }
    });
  }
}
