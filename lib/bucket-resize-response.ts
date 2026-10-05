export type BucketResizeBatch = {
  total: number;
  processed: number;
  resized: number;
  skipped: number;
  errors: Array<{ name: string; error: string }>;
  nextCursor: string | null;
};

export async function readBucketResizeResponse(response: Response): Promise<BucketResizeBatch> {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    const detail = text.trim().startsWith("<") ? "Server returned an HTML error page" : text.trim().slice(0, 200);
    throw new Error(`Bucket resize failed (HTTP ${response.status}): ${detail || "Empty server response"}. Check the Coolify application logs.`);
  }
  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : `Bucket resize failed (HTTP ${response.status})`);
  }
  if (!payload || !["total", "processed", "resized", "skipped"].every(key =>
    Number.isInteger(payload[key]) && payload[key] >= 0) ||
    !Array.isArray(payload.errors) || !payload.errors.every((error: { name?: string; error?: string } | null) =>
      error && typeof error.name === "string" && typeof error.error === "string") ||
    (payload.nextCursor !== null && typeof payload.nextCursor !== "string")) {
    throw new Error("Bucket resize returned an invalid response. Check the Coolify application logs.");
  }
  return payload;
}
