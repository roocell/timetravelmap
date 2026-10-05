import assert from "node:assert/strict";
import { test } from "node:test";
import { readBucketResizeResponse } from "./bucket-resize-response.ts";

test("plain-text HTTP 500 gives a useful error instead of a JSON parse error", async () => {
  await assert.rejects(readBucketResizeResponse(new Response("Internal Server Error", { status: 500 })),
    /HTTP 500.*Internal Server Error.*Coolify/);
});

test("HTML and empty gateway responses are handled", async () => {
  await assert.rejects(readBucketResizeResponse(new Response("<html>Bad Gateway</html>", { status: 502 })),
    /HTTP 502.*HTML error page/);
  await assert.rejects(readBucketResizeResponse(new Response("", { status: 504 })), /HTTP 504.*Empty/);
});

test("JSON API errors keep their original message", async () => {
  await assert.rejects(readBucketResizeResponse(Response.json({ error: "Missing Supabase credentials" }, { status: 500 })),
    /Missing Supabase credentials/);
});

test("valid batches pass through and malformed success responses fail clearly", async () => {
  const batch = { total: 1, processed: 1, resized: 1, skipped: 0, errors: [], nextCursor: null };
  assert.deepEqual(await readBucketResizeResponse(Response.json(batch)), batch);
  for (const invalid of [null, {}, { ...batch, total: "1" }, { ...batch, errors: [null] }]) {
    await assert.rejects(readBucketResizeResponse(Response.json(invalid)), /invalid response/);
  }
});
