import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { registerHooks } from "node:module";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";

const prefix = "https://example.test/storage/v1/object/public/timetravelmap-images/";
const target = "40807a0b2753f156f9e7ada361f49187a67f9630258b3ce91e31138e1bd1c7d8";
const state = { user: null, rows: [], objects: new Map(), uploads: [], updates: [], failUpload: null };
const matching = where => state.rows.filter(row => row.ownerId === where.ownerId &&
  row.storagePath.startsWith(where.storagePath.startsWith) &&
  (!where.id || row.id > where.id.gt));
globalThis.bucketResizeTest = {
  state,
  prisma: {
    image: {
      findMany: async ({ where, take, orderBy }) => {
        assert.deepEqual(orderBy, { id: "asc" });
        return matching(where).sort((a, b) => a.id.localeCompare(b.id)).slice(0, take);
      },
      count: async ({ where }) => matching(where).length,
      update: async update => {
        assert.equal(update.where.ownerId, state.user.id);
        state.updates.push(update);
      }
    }
  },
  storage: {
    getPublicUrl: () => ({ data: { publicUrl: prefix } }),
    download: async objectPath => state.objects.has(objectPath)
      ? { data: new Blob([state.objects.get(objectPath)], { type: "image/png" }), error: null }
      : { data: null, error: new Error("missing") },
    upload: async (objectPath, bytes, options) => {
      if (state.failUpload === objectPath) return { error: new Error("failed") };
      state.uploads.push({ objectPath, bytes, options });
      state.objects.set(objectPath, bytes);
      return { error: null };
    }
  }
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !path.extname(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
  load(url, context, nextLoad) {
    let source;
    if (url.endsWith("/timetravelmap/stack.ts")) {
      source = "export async function getStackUser() { return globalThis.bucketResizeTest.state.user; }";
    } else if (url.endsWith("/lib/prisma.ts")) {
      source = "export const prisma = globalThis.bucketResizeTest.prisma;";
    } else if (url.endsWith("/lib/supabase/admin-client.ts")) {
      source = "export function getSupabaseAdminClient() { return { storage: { from: () => globalThis.bucketResizeTest.storage } }; }";
    }
    return source ? { format: "module", shortCircuit: true, source } : nextLoad(url, context);
  }
});
const { POST } = await import("./route.ts");
const { NextRequest } = await import("next/server.js");
const request = body => new NextRequest("http://localhost:3000/api/backup/resize-images", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
});
const png = (width, height) => sharp({
  create: { width, height, channels: 4, background: { r: 20, g: 180, b: 230, alpha: 0.5 } }
}).png().toBuffer();

test("resizes all account bucket images across batches, keeps paths, and skips small images", async () => {
  state.user = { id: "owner-one", isRestricted: false };
  const large = await png(1920, 1080);
  const small = await png(200, 100);
  for (let index = 1; index <= 4; index++) {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const filename = index === 1 ? target : `other-${index}`;
    state.rows.push({ id, ownerId: state.user.id, storagePath: `${prefix}owner-one/${filename}.png`, altText: `Image ${index}`, mimeType: "image/png" });
    state.objects.set(`owner-one/${filename}.png`, index === 2 ? small : large);
  }
  state.rows.push({ id: "foreign", ownerId: "owner-two", storagePath: `${prefix}owner-two/${target}.png` });
  state.objects.set(`owner-two/${target}.png`, large);
  state.rows.push({ id: "local", ownerId: state.user.id, storagePath: "/images/local.png" });
  state.rows.push({ id: "other-bucket", ownerId: state.user.id, storagePath: "https://example.test/storage/v1/object/public/other-bucket/image.png" });
  const first = await (await POST(request({}))).json();
  assert.equal(first.total, 4);
  assert.equal(first.processed, 3);
  assert.equal(first.resized, 2);
  assert.equal(first.skipped, 1);
  assert.equal(first.errors.length, 0);
  assert.equal(first.nextCursor, state.rows[2].id);
  assert.equal(state.uploads.length, 2);
  const upload = state.uploads[0];
  assert.equal(upload.objectPath, `owner-one/${target}.png`);
  assert.equal(upload.options.upsert, true);
  assert.equal(upload.options.contentType, "image/png");
  const metadata = await sharp(upload.bytes).metadata();
  assert.equal(metadata.width, 960);
  assert.equal(metadata.height, 540);
  assert.ok(metadata.hasAlpha);
  const update = state.updates[0].data;
  assert.equal(update.width, 960);
  assert.equal(update.height, 540);
  assert.equal(update.byteSize, BigInt(upload.bytes.length));
  assert.equal(update.checksumSha256, createHash("sha256").update(upload.bytes).digest("hex"));
  assert.deepEqual(state.objects.get("owner-one/other-2.png"), small);
  assert.notDeepEqual(state.objects.get("owner-one/other-3.png"), large);
  assert.deepEqual(state.objects.get("owner-one/other-4.png"), large);
  assert.equal(state.updates.length, 3);
  const second = await (await POST(request({ cursor: first.nextCursor }))).json();
  assert.equal(second.total, 4);
  assert.equal(second.processed, 1);
  assert.equal(second.resized, 1);
  assert.equal(second.skipped, 0);
  assert.equal(second.errors.length, 0);
  assert.equal(second.nextCursor, null);
  assert.equal(state.uploads.length, 3);
  assert.equal(state.updates.length, 4);
  assert.deepEqual(state.objects.get(`owner-two/${target}.png`), large);
  assert.deepEqual(state.uploads.map(item => item.objectPath), [
    `owner-one/${target}.png`, "owner-one/other-3.png", "owner-one/other-4.png"
  ]);
  const retry = await (await POST(request({}))).json();
  assert.equal(retry.skipped, 3);
  assert.equal(retry.resized, 0);
  assert.equal(retry.errors.length, 0);
  const retryLast = await (await POST(request({ cursor: retry.nextCursor }))).json();
  assert.equal(retryLast.skipped, 1);
  assert.equal(retryLast.nextCursor, null);
  assert.equal(state.uploads.length, 3);
});

test("authentication, access, cursor validation, empty accounts, and missing files", async () => {
  state.user = null;
  assert.equal((await POST(request({}))).status, 401);
  state.user = { id: "owner-one", isRestricted: true };
  assert.equal((await POST(request({}))).status, 403);
  state.user.isRestricted = false;
  assert.equal((await POST(request({ cursor: "bad-cursor" }))).status, 400);
  state.user.id = "empty-owner";
  const empty = await (await POST(request({}))).json();
  assert.equal(empty.total, 0);
  assert.equal(empty.processed, 0);
  assert.equal(empty.nextCursor, null);
  state.user.id = "owner-one";
  state.objects.delete(`owner-one/${target}.png`);
  const failed = await (await POST(request({}))).json();
  assert.equal(failed.errors.length, 1);
  assert.match(failed.errors[0].error, /download/);
});

test("failed images leave files and metadata untouched and do not stop later batches", async () => {
  const invalid = Buffer.from("not an image");
  state.objects.set("owner-one/other-3.png", invalid);
  state.objects.set("owner-one/other-4.png", await png(1920, 1080));
  const previousUploads = state.uploads.length;
  const previousUpdates = state.updates.length;
  const first = await (await POST(request({}))).json();
  assert.equal(first.processed, 3);
  assert.equal(first.skipped, 1);
  assert.equal(first.errors.length, 2);
  assert.equal(first.nextCursor, state.rows[2].id);
  assert.equal(state.uploads.length, previousUploads);
  assert.equal(state.updates.length, previousUpdates + 1);
  assert.deepEqual(state.objects.get("owner-one/other-3.png"), invalid);
  const second = await (await POST(request({ cursor: first.nextCursor }))).json();
  assert.equal(second.resized, 1);
  assert.equal(second.errors.length, 0);
  assert.equal(second.nextCursor, null);
  assert.equal(state.uploads.length, previousUploads + 1);
});

test("a native module load failure is returned as JSON without touching storage", () => {
  const script = `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    import path from 'node:path';
    let signedIn = false;
    globalThis.nativeFailureUser = () => signedIn ? {id:'owner-one', isRestricted:false} : null;
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === 'next/server') return nextResolve('next/server.js', context);
        try { return nextResolve(specifier, context); }
        catch (error) {
          if (specifier.startsWith('.') && !path.extname(specifier)) return nextResolve(specifier + '.ts', context);
          throw error;
        }
      },
      load(url, context, nextLoad) {
        let source;
        if (url.endsWith('/stack.ts')) source = 'export async function getStackUser() { return globalThis.nativeFailureUser(); }';
        if (url.endsWith('/lib/prisma.ts')) source = 'export const prisma = {image:{count:async()=>1,findMany:async()=>[{id:"target",storagePath:"${prefix}owner-one/${target}.png"}]}};';
        if (url.endsWith('/lib/supabase/admin-client.ts')) source = 'export function getSupabaseAdminClient() {return {storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:"${prefix}"}}),download:()=>{throw new Error("Storage must not be touched");},upload:()=>{throw new Error("Storage must not be touched");}})}};}';
        if (url.endsWith('/lib/image-upload.ts')) source = 'throw new Error("Unsupported CPU: Prebuilt binaries for linux-x64 require v2 microarchitecture");';
        return source ? {format:'module', shortCircuit:true, source} : nextLoad(url, context);
      }
    });
    const {POST} = await import(${JSON.stringify(new URL("./route.ts", import.meta.url).href)});
    const {NextRequest} = await import('next/server.js');
    const request = () => new NextRequest('http://localhost/api/backup/resize-images', {method:'POST',body:'{}'});
    assert.equal((await POST(request())).status, 401);
    signedIn = true;
    const response = await POST(request());
    assert.equal(response.headers.get('content-type'), 'application/json');
    const result = await response.json();
    assert.equal(result.resized, 0);
    assert.match(result.errors[0].error, /Unsupported CPU/);
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
