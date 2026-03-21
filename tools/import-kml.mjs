#!/usr/bin/env node

import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { XMLParser } from "fast-xml-parser";
import { StackServerApp } from "../node_modules/@stackframe/stack/dist/lib/stack-app/apps/interfaces/server-app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const KML_DIR = path.join(ROOT, "kml");
const PUBLIC_DIR = path.join(ROOT, "public");
const IMAGE_MANIFEST_PATH = path.join(PUBLIC_DIR, "images", "manifest.json");
const IMAGE_SIZE = "2048";
const PROSPECTS_FILE = "Prospects.kml";
const rawArgs = process.argv.slice(2);
const requestedFiles = rawArgs.filter((value) => !value.startsWith("--"));
const ownerEmailArg =
  rawArgs.find((value) => value.startsWith("--owner-email="))?.slice("--owner-email=".length) ??
  process.env.STACK_IMPORT_OWNER_EMAIL ??
  null;
const DATE_PATTERN = /\b(\d{4,5}-\d{2}-\d{2})\b/;
const SLASH_DATE_PATTERN = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;
const MONTH_YEAR_PATTERN =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i;
const GENERIC_FIND_CODE_PATTERN = /^\d*[CSG]R?$|^\d*R$|^\d*[A-Z]{1,4}$/i;
const COIN_KEYWORDS = [
  "coin",
  "penny",
  "pennies",
  "cent",
  "cents",
  "dime",
  "dimes",
  "quarter",
  "quarters",
  "nickel",
  "nickels",
  "toonie",
  "toonie",
  "loonie",
  "loonie",
  "token",
  "tokens"
];
const RING_KEYWORDS = ["ring", "rings", "band"];
const JEWELRY_KEYWORDS = [
  "jewelry",
  "jewellery",
  "bracelet",
  "necklace",
  "pendant",
  "earring",
  "brooch",
  "medallion"
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  trimValues: false
});

function loadEnvFile(filePath) {
  try {
    const raw = fsSync.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) {
        continue;
      }

      const [, key, value] = match;
      if (process.env[key]) {
        continue;
      }

      let normalized = value.trim();
      if (
        (normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'"))
      ) {
        normalized = normalized.slice(1, -1);
      }

      process.env[key] = normalized.replace(/\\n/g, "\n");
    }
  } catch {
    // Ignore missing env files.
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Add it to .env.local or your shell.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: ["error"]
});

const stackServerApp =
  process.env.NEXT_PUBLIC_STACK_PROJECT_ID &&
  process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY &&
  process.env.STACK_SECRET_SERVER_KEY
    ? new StackServerApp({
        tokenStore: "nextjs-cookie",
        projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID,
        publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
        secretServerKey: process.env.STACK_SECRET_SERVER_KEY,
        urls: {
          handler: "/handler",
          home: "/",
          afterSignIn: "/",
          afterSignUp: "/",
          afterSignOut: "/"
        }
      })
    : null;

function asArray(value) {
  if (value == null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, digits) => String.fromCharCode(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function htmlToLines(html) {
  const normalized = decodeHtmlEntities(
    String(html ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");

  return normalized
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeIsoDateString(value) {
  const match = String(value ?? "").match(/^(\d{4,5})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  let [, year, month, day] = match;
  if (year.length === 5 && year.startsWith("20")) {
    year = year.slice(1);
  }

  if (!/^\d{4}$/.test(year)) {
    return null;
  }

  const candidate = `${year}-${month}-${day}`;
  const date = new Date(`${candidate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (date.toISOString().slice(0, 10) !== candidate) {
    return null;
  }

  return candidate;
}

function findDateString(text) {
  const match = String(text ?? "").match(DATE_PATTERN)?.[1] ?? null;
  return match ? normalizeIsoDateString(match) : null;
}

function stripLeadingDate(text) {
  return String(text ?? "").replace(/^\s*\d{4,5}-\d{2}-\d{2}\s*/, "").trim();
}

function parseDateValue(text, fallback = null) {
  const fallbackDate = normalizeIsoDateString(fallback);
  const dateString = findDateString(text) ?? fallbackDate;
  return dateString ? new Date(`${dateString}T00:00:00.000Z`) : null;
}

function inferSourceFileYearDate(sourceFile) {
  const year = String(sourceFile ?? "").match(/\b(20\d{2})\b/)?.[1];
  return year ? `${year}-01-01` : null;
}

function parseFlexibleDateValue(text) {
  const normalized = String(text ?? "");
  const isoDate = findDateString(normalized);
  if (isoDate) {
    return new Date(`${isoDate}T00:00:00.000Z`);
  }

  const slashMatch = normalized.match(SLASH_DATE_PATTERN);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    return new Date(Date.UTC(year, month - 1, day));
  }

  const monthYearMatch = normalized.match(MONTH_YEAR_PATTERN);
  if (monthYearMatch) {
    return new Date(`${monthYearMatch[1]} 1, ${monthYearMatch[2]} UTC`);
  }

  return null;
}

function parseDurationMinutes(line) {
  if (!line) {
    return null;
  }

  const match = line.match(/(\d+(?:\.\d+)?)\s*(hr|hrs|hour|hours|min|mins|minute|minutes)\b/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("hr") || unit.startsWith("hour")) {
    return Math.round(amount * 60);
  }

  return Math.round(amount);
}

function parseEventHeader(lines) {
  const firstLine = lines[0] ?? "";
  const durationMinutes = parseDurationMinutes(firstLine);
  if (!durationMinutes) {
    return { durationMinutes: null, deviceUsed: null, deviceMode: null };
  }

  const stripped = firstLine
    .replace(/^\s*\d+(?:\.\d+)?\s*(?:hr|hrs|hour|hours|min|mins|minute|minutes)\b/i, "")
    .trim();
  if (!stripped) {
    return { durationMinutes, deviceUsed: null, deviceMode: null };
  }

  const [deviceUsed, ...rest] = stripped.split(/\s+/);
  return {
    durationMinutes,
    deviceUsed: deviceUsed || null,
    deviceMode: rest.length > 0 ? rest.join(" ") : null
  };
}

function kmlColorToCss(value) {
  const raw = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}$/i.test(raw)) {
    return null;
  }

  const a = raw.slice(0, 2);
  const b = raw.slice(2, 4);
  const g = raw.slice(4, 6);
  const r = raw.slice(6, 8);
  return `#${r}${g}${b}${a}`.toLowerCase();
}

function buildStyleIndex(documentNode) {
  const styles = new Map();
  const styleMaps = new Map();

  for (const style of asArray(documentNode["gx:CascadingStyle"])) {
    const styleId = style["kml:id"] ?? style.id;
    if (!styleId || !style.Style) {
      continue;
    }

    styles.set(`#${styleId}`, {
      fillColor: kmlColorToCss(style.Style.PolyStyle?.color),
      outlineColor: kmlColorToCss(style.Style.LineStyle?.color),
      outlineWidth: style.Style.LineStyle?.width ? Number(style.Style.LineStyle.width) : null
    });
  }

  for (const styleMap of asArray(documentNode.StyleMap)) {
    const styleId = styleMap.id ?? styleMap["kml:id"];
    if (!styleId) {
      continue;
    }

    const normalPair = asArray(styleMap.Pair).find((pair) => pair.key === "normal");
    if (normalPair?.styleUrl) {
      styleMaps.set(`#${styleId}`, String(normalPair.styleUrl).trim());
    }
  }

  return { styles, styleMaps };
}

function resolveStyle(styleUrl, styleIndex) {
  if (!styleUrl) {
    return { fillColor: null, outlineColor: null, outlineWidth: null };
  }

  let resolved = String(styleUrl).trim();
  if (styleIndex.styleMaps.has(resolved)) {
    resolved = styleIndex.styleMaps.get(resolved);
  }

  return styleIndex.styles.get(resolved) ?? {
    fillColor: null,
    outlineColor: null,
    outlineWidth: null
  };
}

function parseCoordinateString(raw) {
  return String(raw ?? "")
    .trim()
    .split(/\s+/)
    .map((chunk) => chunk.split(",").map(Number))
    .filter((parts) => Number.isFinite(parts[0]) && Number.isFinite(parts[1]))
    .map(([lon, lat]) => [lon, lat]);
}

function ensureClosedRing(points) {
  if (points.length === 0) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return points;
  }

  return [...points, first];
}

function polygonToWkt(placemark) {
  const coordinates = placemark.Polygon?.outerBoundaryIs?.LinearRing?.coordinates;
  const points = ensureClosedRing(parseCoordinateString(coordinates));
  if (points.length < 4) {
    return null;
  }

  const ring = points.map(([lon, lat]) => `${lon} ${lat}`).join(", ");
  return `MULTIPOLYGON(((${ring})))`;
}

function lineStringToThinPolygonWkt(placemark, halfWidthMeters = 4) {
  const points = parseCoordinateString(placemark.LineString?.coordinates);
  if (points.length < 2) {
    return null;
  }

  const averageLatRadians =
    (points.reduce((total, [, lat]) => total + lat, 0) / points.length) * (Math.PI / 180);
  const metersPerLon = 111320 * Math.cos(averageLatRadians);
  const metersPerLat = 110540;

  if (!Number.isFinite(metersPerLon) || metersPerLon <= 0) {
    return null;
  }

  const projected = points.map(([lon, lat]) => ({
    x: lon * metersPerLon,
    y: lat * metersPerLat
  }));

  const segmentNormals = [];
  for (let index = 0; index < projected.length - 1; index += 1) {
    const start = projected[index];
    const end = projected[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);

    if (!Number.isFinite(length) || length === 0) {
      segmentNormals.push({ x: 0, y: 0 });
      continue;
    }

    segmentNormals.push({
      x: -dy / length,
      y: dx / length
    });
  }

  const leftSide = [];
  const rightSide = [];

  for (let index = 0; index < projected.length; index += 1) {
    const point = projected[index];
    const previous = segmentNormals[index - 1] ?? segmentNormals[index] ?? { x: 0, y: 0 };
    const next = segmentNormals[index] ?? segmentNormals[index - 1] ?? { x: 0, y: 0 };
    let normalX = previous.x + next.x;
    let normalY = previous.y + next.y;
    const normalLength = Math.hypot(normalX, normalY);

    if (!Number.isFinite(normalLength) || normalLength === 0) {
      normalX = next.x || previous.x;
      normalY = next.y || previous.y;
    } else {
      normalX /= normalLength;
      normalY /= normalLength;
    }

    leftSide.push([
      (point.x + normalX * halfWidthMeters) / metersPerLon,
      (point.y + normalY * halfWidthMeters) / metersPerLat
    ]);
    rightSide.push([
      (point.x - normalX * halfWidthMeters) / metersPerLon,
      (point.y - normalY * halfWidthMeters) / metersPerLat
    ]);
  }

  const ring = ensureClosedRing([...leftSide, ...rightSide.reverse()]);
  if (ring.length < 4) {
    return null;
  }

  return `MULTIPOLYGON(((${ring.map(([lon, lat]) => `${lon} ${lat}`).join(", ")})))`;
}

function eventGeometryToWkt(placemark) {
  return polygonToWkt(placemark) ?? lineStringToThinPolygonWkt(placemark);
}

function pointToLatLng(placemark) {
  const coordinates = parseCoordinateString(placemark.Point?.coordinates);
  if (coordinates.length === 0) {
    return null;
  }

  const [lon, lat] = coordinates[0];
  return {
    latitude: lat,
    longitude: lon
  };
}

function polygonToLatLng(placemark) {
  const coordinates = placemark.Polygon?.outerBoundaryIs?.LinearRing?.coordinates;
  const points = parseCoordinateString(coordinates);
  if (points.length === 0) {
    return null;
  }

  const uniquePoints =
    points.length > 1 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
      ? points.slice(0, -1)
      : points;

  const totals = uniquePoints.reduce(
    (accumulator, [lon, lat]) => {
      accumulator.lon += lon;
      accumulator.lat += lat;
      return accumulator;
    },
    { lon: 0, lat: 0 }
  );

  return {
    latitude: totals.lat / uniquePoints.length,
    longitude: totals.lon / uniquePoints.length
  };
}

function placemarkToLatLng(placemark) {
  return (
    pointToLatLng(placemark) ??
    polygonToLatLng(placemark) ??
    (placemark.LookAt?.latitude && placemark.LookAt?.longitude
      ? {
          latitude: Number(placemark.LookAt.latitude),
          longitude: Number(placemark.LookAt.longitude)
        }
      : null)
  );
}

function normalizeImageUrl(url) {
  return String(url ?? "").replace("{size}", IMAGE_SIZE).trim();
}

function extractImageUrls(placemark) {
  const carousel = placemark["gx:Carousel"];
  if (!carousel) {
    return [];
  }

  return asArray(carousel["gx:Image"])
    .map((image) => normalizeImageUrl(image["gx:imageUrl"]))
    .filter(Boolean);
}

function createPlainDescription(lines) {
  return lines.length > 0 ? lines.join("\n") : null;
}

function normalizeLineForComparison(line) {
  return String(line ?? "")
    .toLowerCase()
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeDescriptionLines(lines, ignoredLines = []) {
  const ignored = new Set(
    ignoredLines
      .map((line) => normalizeLineForComparison(line))
      .filter(Boolean)
  );

  return lines.filter((line) => {
    const normalized = normalizeLineForComparison(line);
    return normalized && !ignored.has(normalized);
  });
}

function cleanEventDescriptionLines(lines, header) {
  if (lines.length === 0) {
    return [];
  }

  const ignoredLines = [];
  if (header.durationMinutes) {
    ignoredLines.push(lines[0]);
  }

  return dedupeDescriptionLines(lines, ignoredLines);
}

function isGenericFindCode(title) {
  const normalized = String(title ?? "").trim().toUpperCase();
  return GENERIC_FIND_CODE_PATTERN.test(normalized);
}

function extractPrimaryFindText(lines, originalTitle) {
  const cleanedLines = lines
    .map((line) => line.replace(DATE_PATTERN, "").trim())
    .filter(Boolean);
  return cleanedLines[0] ?? originalTitle;
}

function parseCount(title, text) {
  const titleMatch = String(title ?? "").match(/^(\d+)/);
  if (titleMatch) {
    const value = Number(titleMatch[1]);
    if (value !== 925) {
      return value;
    }
  }

  const textMatch = String(text ?? "").match(/\b(\d+)\s+(?:ring|rings|coin|coins|button|buttons)\b/i);
  if (!textMatch) {
    return null;
  }

  const value = Number(textMatch[1]);
  return value === 925 ? null : value;
}

function parseMetal(title, text) {
  const upperTitle = String(title ?? "").toUpperCase();
  const codeMatch = upperTitle.match(/^[0-9]*([CSG])/);
  if (codeMatch) {
    return codeMatch[1];
  }

  const combined = String(text ?? "").toLowerCase();
  if (/\b925\b/.test(combined) || /\b925\b/.test(String(title ?? ""))) {
    return "S";
  }
  if (combined.includes("silver")) {
    return "S";
  }
  if (combined.includes("gold")) {
    return "G";
  }
  if (combined.includes("copper") || combined.includes("bronze")) {
    return "C";
  }

  return null;
}

function inferFindType(title, text) {
  const normalized = `${title ?? ""} ${text ?? ""}`.toLowerCase();
  const upperTitle = String(title ?? "").toUpperCase();

  if (upperTitle.includes("R") && !COIN_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "ring";
  }
  if (RING_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "ring";
  }
  if (COIN_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "coin";
  }
  if (JEWELRY_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "jewelry";
  }

  return "artifact";
}

function parseAge(text) {
  const normalized = String(text ?? "").replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
  const decadeMatch = normalized.match(/\b(1[0-9]{3}|20[0-9]{2})s\b/i);
  if (decadeMatch) {
    const start = Number(decadeMatch[1]);
    return {
      ageLabel: `${decadeMatch[1]}s`,
      ageStartYear: start,
      ageEndYear: start + 9
    };
  }

  const years = [...normalized.matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year >= 1000 && year <= 2099);

  if (years.length === 0) {
    return { ageLabel: null, ageStartYear: null, ageEndYear: null };
  }

  const ageStartYear = Math.min(...years);
  const ageEndYear = Math.max(...years);
  return {
    ageLabel:
      ageStartYear === ageEndYear ? String(ageStartYear) : `${ageStartYear}-${ageEndYear}`,
    ageStartYear,
    ageEndYear
  };
}

function cleanFindDescriptionLines(lines, title, findDate) {
  const ignoredLines = [];
  const dateString = findDate ? findDate.toISOString().slice(0, 10) : null;

  for (const line of lines) {
    const normalizedLine = normalizeLineForComparison(line);
    const normalizedTitle = normalizeLineForComparison(title);
    const withoutDate = normalizeLineForComparison(
      dateString ? line.replace(dateString, " ") : line
    );

    if (normalizedLine === normalizedTitle || withoutDate === normalizedTitle) {
      ignoredLines.push(line);
      continue;
    }

    if (dateString && normalizedLine === normalizeLineForComparison(dateString)) {
      ignoredLines.push(line);
    }
  }

  return dedupeDescriptionLines(lines, ignoredLines);
}

function parseProspectDates(lines) {
  let dateVisited = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const parsed = parseFlexibleDateValue(line);
    if (!parsed) {
      continue;
    }

    if (lower.includes("visited")) {
      dateVisited = dateVisited ?? parsed;
      continue;
    }

    if (
      lower.includes("scouting mission") ||
      lower.includes("found it") ||
      lower.includes("found ") ||
      lower.includes("added")
    ) {
      continue;
    }
  }

  return {
    dateVisited
  };
}

async function loadImageManifest() {
  const raw = await fs.readFile(IMAGE_MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw);
  return manifest.images ?? {};
}

async function ensureImageRecords(imageUrls, sourceName, altText, manifest) {
  const records = [];

  for (const originalUrl of imageUrls) {
    const manifestEntry = manifest[originalUrl];
    if (!manifestEntry?.file) {
      console.warn(`Skipping missing local image for ${originalUrl}`);
      continue;
    }

    const legacyStoragePath = manifestEntry.file;
    const fileName = path.basename(String(legacyStoragePath ?? ""));
    const storagePath =
      IMPORT_OWNER_ID && fileName
        ? `/images/${IMPORT_OWNER_ID}/${fileName}`
        : legacyStoragePath;

    const absolutePath = path.join(PUBLIC_DIR, storagePath.replace(/^\//, ""));
    const legacyAbsolutePath = path.join(PUBLIC_DIR, String(legacyStoragePath).replace(/^\//, ""));
    let stats;
    try {
      stats = await fs.stat(absolutePath);
    } catch {
      try {
        stats = await fs.stat(legacyAbsolutePath);

        if (absolutePath !== legacyAbsolutePath) {
          await fs.mkdir(path.dirname(absolutePath), { recursive: true });
          await fs.copyFile(legacyAbsolutePath, absolutePath);
        }
      } catch {
        console.warn(`Skipping image with missing file ${absolutePath}`);
        continue;
      }
    }

    const image = await prisma.image.upsert({
      where: { storagePath },
      update: {
        ownerId: IMPORT_OWNER_ID,
        originalUrl,
        byteSize: BigInt(stats.size),
        altText: altText || null,
        sourceName,
        checksumSha256: manifestEntry.sha256 ?? null
      },
      create: {
        ownerId: IMPORT_OWNER_ID,
        storagePath,
        originalUrl,
        byteSize: BigInt(stats.size),
        altText: altText || null,
        sourceName,
        checksumSha256: manifestEntry.sha256 ?? null
      }
    });

    records.push(image);
  }

  return records;
}

async function upsertEvent(input) {
  const rows = await prisma.$queryRaw(
    Prisma.sql`
      insert into timetravelmap.events (
        owner_id,
        title,
        event_date,
        duration_minutes,
        device_used,
        device_mode,
        description,
        fill_color,
        outline_color,
        outline_width,
        area,
        source_file,
        source_placemark_id
      )
      values (
        ${input.ownerId},
        ${input.title},
        ${input.eventDate},
        ${input.durationMinutes},
        ${input.deviceUsed},
        ${input.deviceMode},
        ${input.description},
        ${input.fillColor},
        ${input.outlineColor},
        ${input.outlineWidth},
        ST_Multi(
          ST_CollectionExtract(
            ST_MakeValid(ST_GeomFromText(${input.areaWkt}, 4326)),
            3
          )
        ),
        ${input.sourceFile},
        ${input.sourcePlacemarkId}
      )
      on conflict (source_file, source_placemark_id) do update
      set
        owner_id = excluded.owner_id,
        title = excluded.title,
        event_date = excluded.event_date,
        duration_minutes = excluded.duration_minutes,
        device_used = excluded.device_used,
        device_mode = excluded.device_mode,
        description = excluded.description,
        fill_color = excluded.fill_color,
        outline_color = excluded.outline_color,
        outline_width = excluded.outline_width,
        area = excluded.area
      returning id
    `
  );

  return rows[0]?.id ?? null;
}

async function upsertFind(input) {
  const rows = await prisma.$queryRaw(
    Prisma.sql`
      insert into timetravelmap.finds (
        owner_id,
        event_id,
        title,
        find_date,
        age_label,
        age_start_year,
        age_end_year,
        type,
        metal,
        item_count,
        description,
        latitude,
        longitude,
        source_file,
        source_placemark_id
      )
      values (
        ${input.ownerId},
        ${input.eventId},
        ${input.title},
        ${input.findDate},
        ${input.ageLabel},
        ${input.ageStartYear},
        ${input.ageEndYear},
        CAST(${input.type} AS timetravelmap.find_type),
        CAST(${input.metal} AS timetravelmap.metal_code),
        ${input.itemCount},
        ${input.description},
        ${input.latitude},
        ${input.longitude},
        ${input.sourceFile},
        ${input.sourcePlacemarkId}
      )
      on conflict (source_file, source_placemark_id) do update
      set
        owner_id = excluded.owner_id,
        event_id = excluded.event_id,
        title = excluded.title,
        find_date = excluded.find_date,
        age_label = excluded.age_label,
        age_start_year = excluded.age_start_year,
        age_end_year = excluded.age_end_year,
        type = excluded.type,
        metal = excluded.metal,
        item_count = excluded.item_count,
        description = excluded.description,
        latitude = excluded.latitude,
        longitude = excluded.longitude
      returning id
    `
  );

  return rows[0]?.id ?? null;
}

async function upsertProspect(input) {
  const rows = await prisma.$queryRaw(
    Prisma.sql`
      insert into timetravelmap.prospects (
        owner_id,
        title,
        age_label,
        age_start_year,
        age_end_year,
        description,
        latitude,
        longitude,
        date_visited,
        source_file,
        source_placemark_id
      )
      values (
        ${input.ownerId},
        ${input.title},
        ${input.ageLabel},
        ${input.ageStartYear},
        ${input.ageEndYear},
        ${input.description},
        ${input.latitude},
        ${input.longitude},
        ${input.dateVisited},
        ${input.sourceFile},
        ${input.sourcePlacemarkId}
      )
      on conflict (source_file, source_placemark_id) do update
      set
        owner_id = excluded.owner_id,
        title = excluded.title,
        age_label = excluded.age_label,
        age_start_year = excluded.age_start_year,
        age_end_year = excluded.age_end_year,
        description = excluded.description,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        date_visited = excluded.date_visited
      returning id
    `
  );

  return rows[0]?.id ?? null;
}

function buildEventRecord(placemark, sourceFile, style) {
  const originalTitle = String(placemark.name ?? "").trim();
  const lines = htmlToLines(placemark.description);
  const eventDate = parseDateValue(originalTitle, inferSourceFileYearDate(sourceFile));
  if (!eventDate) {
    return null;
  }

  const areaWkt = eventGeometryToWkt(placemark);
  if (!areaWkt) {
    return null;
  }

  const header = parseEventHeader(lines);
  const descriptionLines = cleanEventDescriptionLines(lines, header);
  const title = stripLeadingDate(originalTitle) || originalTitle;
  return {
    ownerId: IMPORT_OWNER_ID,
    title,
    eventDate,
    durationMinutes: header.durationMinutes,
    deviceUsed: header.deviceUsed,
    deviceMode: header.deviceMode,
    description: createPlainDescription(descriptionLines),
    fillColor: style.fillColor,
    outlineColor: style.outlineColor,
    outlineWidth: style.outlineWidth,
    areaWkt,
    sourceFile,
    sourcePlacemarkId: String(placemark.id ?? "").trim() || null,
    imageUrls: extractImageUrls(placemark)
  };
}

function buildFindRecord(placemark, sourceFile, currentEventContext) {
  const originalTitle = String(placemark.name ?? "").trim();
  const lines = htmlToLines(placemark.description);
  const description = createPlainDescription(lines);
  const fallbackDateString = currentEventContext?.eventDateString ?? null;
  const findDate = parseDateValue(`${originalTitle}\n${description ?? ""}`, fallbackDateString);
  if (!findDate) {
    return null;
  }

  const point = pointToLatLng(placemark);
  if (!point) {
    return null;
  }

  const primaryText = extractPrimaryFindText(lines, originalTitle);
  const title = isGenericFindCode(originalTitle)
    ? primaryText
    : stripLeadingDate(originalTitle) || originalTitle;
  const descriptionLines = cleanFindDescriptionLines(lines, title, findDate);
  const age = parseAge(`${title}\n${description ?? ""}`);
  const type = inferFindType(originalTitle, `${title}\n${description ?? ""}`);
  const metal = parseMetal(originalTitle, `${title}\n${description ?? ""}`);
  const itemCount = parseCount(originalTitle, `${title}\n${description ?? ""}`);

  return {
    ownerId: IMPORT_OWNER_ID,
    eventId: currentEventContext?.eventId ?? null,
    title,
    findDate,
    ageLabel: age.ageLabel,
    ageStartYear: age.ageStartYear,
    ageEndYear: age.ageEndYear,
    type,
    metal,
    itemCount,
    description: createPlainDescription(descriptionLines),
    latitude: point.latitude,
    longitude: point.longitude,
    sourceFile,
    sourcePlacemarkId: String(placemark.id ?? "").trim() || null,
    imageUrls: extractImageUrls(placemark)
  };
}

function buildProspectRecord(placemark, sourceFile) {
  const originalTitle = String(placemark.name ?? "").trim();
  if (!originalTitle) {
    return null;
  }

  const lines = htmlToLines(placemark.description);
  const point = placemarkToLatLng(placemark);
  if (!point) {
    return null;
  }

  const dates = parseProspectDates(lines);
  const title = stripLeadingDate(originalTitle) || originalTitle;
  const age = parseAge(`${title}\n${createPlainDescription(lines) ?? ""}`);

  return {
    ownerId: IMPORT_OWNER_ID,
    title,
    ageLabel: age.ageLabel,
    ageStartYear: age.ageStartYear,
    ageEndYear: age.ageEndYear,
    description: createPlainDescription(lines),
    latitude: point.latitude,
    longitude: point.longitude,
    dateVisited: dates.dateVisited,
    sourceFile,
    sourcePlacemarkId: String(placemark.id ?? "").trim() || null,
    imageUrls: extractImageUrls(placemark),
    sourceName: sourceFile
  };
}

async function attachEventImages(eventId, images) {
  await prisma.eventImage.deleteMany({
    where: { eventId }
  });

  if (images.length === 0) {
    return;
  }

  await prisma.eventImage.createMany({
    data: images.map((image, index) => ({
      eventId,
      imageId: image.id,
      sortOrder: index
    }))
  });
}

async function attachFindImages(findId, images) {
  await prisma.findImage.deleteMany({
    where: { findId }
  });

  if (images.length === 0) {
    return;
  }

  await prisma.findImage.createMany({
    data: images.map((image, index) => ({
      findId,
      imageId: image.id,
      sortOrder: index
    }))
  });
}

async function attachProspectImages(prospectId, images) {
  await prisma.prospectImage.deleteMany({
    where: { prospectId }
  });

  if (images.length === 0) {
    return;
  }

  await prisma.prospectImage.createMany({
    data: images.map((image, index) => ({
      prospectId,
      imageId: image.id,
      sortOrder: index
    }))
  });
}

async function pruneFileImports(sourceFile, importedEventIds, importedFindIds) {
  if (importedFindIds.length > 0) {
    await prisma.find.deleteMany({
      where: {
        sourceFile,
        sourcePlacemarkId: {
          notIn: importedFindIds
        }
      }
    });
  }

  if (importedEventIds.length > 0) {
    await prisma.event.deleteMany({
      where: {
        sourceFile,
        sourcePlacemarkId: {
          notIn: importedEventIds
        }
      }
    });
  }
}

async function pruneProspectFileImports(sourceFile, importedProspectIds) {
  if (importedProspectIds.length === 0) {
    return;
  }

  await prisma.prospect.deleteMany({
    where: {
      sourceFile,
      sourcePlacemarkId: {
        notIn: importedProspectIds
      }
    }
  });
}

async function resolveImportOwnerId() {
  if (!ownerEmailArg) {
    return null;
  }

  if (!stackServerApp) {
    throw new Error(
      "Missing Stack Auth env vars. Set NEXT_PUBLIC_STACK_PROJECT_ID, NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY, and STACK_SECRET_SERVER_KEY before importing with --owner-email."
    );
  }

  let cursor = undefined;

  for (;;) {
    const users = await stackServerApp.listUsers(
      cursor ? { cursor } : undefined
    );
    const match = users.find(
      (user) => String(user.primaryEmail ?? "").toLowerCase() === ownerEmailArg.toLowerCase()
    );
    if (match) {
      return match.id;
    }

    if (!users.nextCursor) {
      break;
    }

    cursor = users.nextCursor;
  }

  throw new Error(`No Stack user found for ${ownerEmailArg}`);
}

const IMPORT_OWNER_ID = await resolveImportOwnerId();

async function importFile(fileName, manifest) {
  const filePath = path.join(KML_DIR, fileName);
  const raw = await fs.readFile(filePath, "utf8");
  const kml = parser.parse(raw);
  const documentNode = kml.kml?.Document;
  if (!documentNode) {
    throw new Error(`Missing Document node in ${fileName}`);
  }

  const styleIndex = buildStyleIndex(documentNode);
  const placemarks = asArray(documentNode.Placemark);
  const importedEventIds = [];
  const importedFindIds = [];
  let currentEventContext = null;
  let eventCount = 0;
  let findCount = 0;

  for (const placemark of placemarks) {
    const style = resolveStyle(placemark.styleUrl, styleIndex);

    if (placemark.Polygon || placemark.LineString) {
      const event = buildEventRecord(placemark, fileName, style);
      if (!event || !event.sourcePlacemarkId) {
        continue;
      }

      const eventId = await upsertEvent(event);
      if (!eventId) {
        continue;
      }

      const images = await ensureImageRecords(event.imageUrls, fileName, event.title, manifest);
      await attachEventImages(eventId, images);

      currentEventContext = {
        eventId,
        eventDateString: event.eventDate.toISOString().slice(0, 10)
      };
      importedEventIds.push(event.sourcePlacemarkId);
      eventCount += 1;
      continue;
    }

    if (placemark.Point) {
      const find = buildFindRecord(placemark, fileName, currentEventContext);
      if (!find || !find.sourcePlacemarkId) {
        continue;
      }

      const findId = await upsertFind(find);
      if (!findId) {
        continue;
      }

      const images = await ensureImageRecords(find.imageUrls, fileName, find.title, manifest);
      await attachFindImages(findId, images);

      importedFindIds.push(find.sourcePlacemarkId);
      findCount += 1;
    }
  }

  await pruneFileImports(fileName, importedEventIds, importedFindIds);

  return {
    fileName,
    eventCount,
    findCount,
    prospectCount: 0
  };
}

async function importProspectsFile(fileName, manifest) {
  const filePath = path.join(KML_DIR, fileName);
  const raw = await fs.readFile(filePath, "utf8");
  const kml = parser.parse(raw);
  const documentNode = kml.kml?.Document;
  if (!documentNode) {
    throw new Error(`Missing Document node in ${fileName}`);
  }

  const placemarks = asArray(documentNode.Placemark);
  const importedProspectIds = [];
  let prospectCount = 0;

  for (const placemark of placemarks) {
    const prospect = buildProspectRecord(placemark, fileName);
    if (!prospect || !prospect.sourcePlacemarkId) {
      continue;
    }

    const prospectId = await upsertProspect(prospect);
    if (!prospectId) {
      continue;
    }

    const images = await ensureImageRecords(
      prospect.imageUrls,
      prospect.sourceName,
      prospect.title,
      manifest
    );
    await attachProspectImages(prospectId, images);
    importedProspectIds.push(prospect.sourcePlacemarkId);
    prospectCount += 1;
  }

  await pruneProspectFileImports(fileName, importedProspectIds);

  return {
    fileName,
    eventCount: 0,
    findCount: 0,
    prospectCount
  };
}

async function main() {
  try {
    if (ownerEmailArg) {
      console.log(`Import owner: ${ownerEmailArg} -> ${IMPORT_OWNER_ID}`);
    } else {
      console.log("Import owner: none");
    }

    const manifest = await loadImageManifest();
    let files = (await fs.readdir(KML_DIR))
      .filter((fileName) => fileName.endsWith(".kml"))
      .sort();

    if (requestedFiles.length > 0) {
      const requestedSet = new Set(requestedFiles);
      files = files.filter((fileName) => requestedSet.has(fileName));

      if (files.length === 0) {
        throw new Error(
          `No matching KML files found for: ${requestedFiles.join(", ")}`
        );
      }
    }

    const summaries = [];

    for (const fileName of files) {
      const summary =
        fileName === PROSPECTS_FILE
          ? await importProspectsFile(fileName, manifest)
          : await importFile(fileName, manifest);
      summaries.push(summary);
      if (fileName === PROSPECTS_FILE) {
        console.log(`${fileName}: imported ${summary.prospectCount} prospects`);
      } else {
        console.log(
          `${fileName}: imported ${summary.eventCount} events and ${summary.findCount} finds`
        );
      }
    }

    const totals = summaries.reduce(
      (accumulator, summary) => {
        accumulator.events += summary.eventCount;
        accumulator.finds += summary.findCount;
        accumulator.prospects += summary.prospectCount;
        return accumulator;
      },
      { events: 0, finds: 0, prospects: 0 }
    );

    console.log(
      `Finished KML import: ${totals.events} events, ${totals.finds} finds, and ${totals.prospects} prospects across ${summaries.length} files`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
