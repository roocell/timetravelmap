import { NextResponse } from "next/server";
import { getStackUser } from "../../../stack";
import { canAccessApp } from "../../../lib/access";
import { ensureDefaultUserTilesets } from "../../../lib/user-tilesets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type YearCount = {
  year: number;
  count: bigint | number;
};

type EventAreaRow = {
  year: number;
  area_m2: number | string | null;
};

type EventListRow = {
  year: number;
  id: string;
  title: string;
  event_date: Date | string;
  description: string | null;
};

type FindListRow = {
  year: number;
  id: string;
  title: string;
  find_date: Date | string;
  description: string | null;
};

type ProspectListRow = {
  id: string;
  title: string;
  date_visited: Date | string | null;
  description: string | null;
};

type TilesetRow = {
  id: string;
  name: string | null;
  provider_type: string;
  is_visible: boolean;
  url: string;
  sort_order: number;
};

function toSafeNumber(value: bigint | number | string | null | undefined) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toIsoDateString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const user = await getStackUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessApp(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { prisma } = await import("../../../lib/prisma");
    await ensureDefaultUserTilesets(prisma, user.id);
    const [eventRows, findRows, eventAreaRows, eventListRows, findListRows, prospectCountRows, prospectListRows, tilesetRows] =
      await Promise.all([
      prisma.$queryRaw<YearCount[]>`
        select extract(year from event_date)::int as year, count(*)::bigint as count
        from timetravelmap.events
        where owner_id = ${user.id}
        group by 1
        order by 1 desc
      `,
      prisma.$queryRaw<YearCount[]>`
        select extract(year from find_date)::int as year, count(*)::bigint as count
        from timetravelmap.finds
        where owner_id = ${user.id}
        group by 1
        order by 1 desc
      `,
      prisma.$queryRaw<EventAreaRow[]>`
        select
          extract(year from event_date)::int as year,
          coalesce(sum(area_m2), 0)::double precision as area_m2
        from timetravelmap.events
        where owner_id = ${user.id}
        group by 1
        order by 1 desc
      `,
      prisma.$queryRaw<EventListRow[]>`
        select
          extract(year from event_date)::int as year,
          id,
          title,
          event_date,
          description
        from timetravelmap.events
        where owner_id = ${user.id}
        order by event_date asc, title asc
      `,
      prisma.$queryRaw<FindListRow[]>`
        select
          extract(year from find_date)::int as year,
          id,
          title,
          find_date,
          description
        from timetravelmap.finds
        where owner_id = ${user.id}
        order by find_date asc, title asc
      `,
      prisma.$queryRaw<Array<{ count: bigint | number | string }>>`
        select count(*)::bigint as count
        from timetravelmap.prospects
        where owner_id = ${user.id}
      `,
      prisma.$queryRaw<ProspectListRow[]>`
        select
          id,
          title,
          date_visited,
          description
        from timetravelmap.prospects
        where owner_id = ${user.id}
        order by date_visited asc nulls last, title asc
      `,
      prisma.$queryRaw<TilesetRow[]>`
        select
          id,
          name,
          provider_type,
          is_visible,
          url,
          sort_order
        from timetravelmap.user_tilesets
        where owner_id = ${user.id}
        order by sort_order asc, created_at asc
      `
    ]);

    const years = new Map<
      number,
      {
        year: number;
        eventCount: number;
        findCount: number;
        areaTotalM2: number;
        entries: Array<{
          id: string;
          kind: "event" | "find";
          title: string;
          date: string;
          description: string | null;
        }>;
      }
    >();

    for (const row of eventRows) {
      const year = toSafeNumber(row.year);
      years.set(year, {
        year,
        eventCount: toSafeNumber(row.count),
        findCount: years.get(year)?.findCount ?? 0,
        areaTotalM2: years.get(year)?.areaTotalM2 ?? 0,
        entries: years.get(year)?.entries ?? []
      });
    }

    for (const row of findRows) {
      const year = toSafeNumber(row.year);
      const existing = years.get(year);
      years.set(year, {
        year,
        eventCount: existing?.eventCount ?? 0,
        findCount: toSafeNumber(row.count),
        areaTotalM2: existing?.areaTotalM2 ?? 0,
        entries: existing?.entries ?? []
      });
    }

    for (const row of eventAreaRows) {
      const year = toSafeNumber(row.year);
      const existing = years.get(year);
      years.set(year, {
        year,
        eventCount: existing?.eventCount ?? 0,
        findCount: existing?.findCount ?? 0,
        areaTotalM2: toSafeNumber(row.area_m2),
        entries: existing?.entries ?? []
      });
    }

    for (const row of eventListRows) {
      const existing = years.get(toSafeNumber(row.year));
      if (!existing) {
        continue;
      }

      existing.entries.push({
        id: row.id,
        kind: "event",
        title: row.title,
        date: toIsoDateString(row.event_date) ?? "",
        description: row.description
      });
    }

    for (const row of findListRows) {
      const existing = years.get(toSafeNumber(row.year));
      if (!existing) {
        continue;
      }

      existing.entries.push({
        id: row.id,
        kind: "find",
        title: row.title,
        date: toIsoDateString(row.find_date) ?? "",
        description: row.description
      });
    }

    for (const year of years.values()) {
      year.entries.sort((left, right) => {
        if (left.date !== right.date) {
          return left.date.localeCompare(right.date);
        }

        if (left.kind !== right.kind) {
          return left.kind.localeCompare(right.kind);
        }

        return left.title.localeCompare(right.title);
      });
    }

    return NextResponse.json({
      years: [...years.values()].sort((left, right) => right.year - left.year),
      prospects: {
        count: toSafeNumber(prospectCountRows[0]?.count),
        entries: prospectListRows.map((row) => ({
          id: row.id,
          title: row.title,
          date: toIsoDateString(row.date_visited),
          description: row.description
        }))
      },
      settings: {
        tilesets: tilesetRows.map((row) => ({
          id: row.id,
          name: row.name,
          type: row.provider_type,
          visible: row.is_visible,
          url: row.url,
          sortOrder: row.sort_order
        }))
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown datasets error"
      },
      { status: 500 }
    );
  }
}
