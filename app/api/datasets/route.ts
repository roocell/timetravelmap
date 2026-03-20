import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type YearCount = {
  year: number;
  count: bigint | number;
};

type EventListRow = {
  year: number;
  id: string;
  title: string;
  event_date: Date | string;
};

type FindListRow = {
  year: number;
  id: string;
  title: string;
  find_date: Date | string;
};

type ProspectListRow = {
  id: string;
  title: string;
  date_visited: Date | string | null;
};

export async function GET() {
  const { prisma } = await import("../../../lib/prisma");
  const [eventRows, findRows, eventListRows, findListRows, prospectCount, prospectListRows] =
    await Promise.all([
    prisma.$queryRaw<YearCount[]>`
      select extract(year from event_date)::int as year, count(*)::bigint as count
      from timetravelmap.events
      group by 1
      order by 1 desc
    `,
    prisma.$queryRaw<YearCount[]>`
      select extract(year from find_date)::int as year, count(*)::bigint as count
      from timetravelmap.finds
      group by 1
      order by 1 desc
    `,
    prisma.$queryRaw<EventListRow[]>`
      select
        extract(year from event_date)::int as year,
        id,
        title,
        event_date
      from timetravelmap.events
      order by event_date asc, title asc
    `,
    prisma.$queryRaw<FindListRow[]>`
      select
        extract(year from find_date)::int as year,
        id,
        title,
        find_date
      from timetravelmap.finds
      order by find_date asc, title asc
    `,
    prisma.prospect.count(),
    prisma.$queryRaw<ProspectListRow[]>`
      select
        id,
        title,
        date_visited
      from timetravelmap.prospects
      order by date_visited asc nulls last, title asc
    `
  ]);

  const years = new Map<
    number,
    {
      year: number;
      eventCount: number;
      findCount: number;
      entries: Array<{
        id: string;
        kind: "event" | "find";
        title: string;
        date: string;
      }>;
    }
  >();

  for (const row of eventRows) {
    years.set(row.year, {
      year: row.year,
      eventCount: Number(row.count),
      findCount: years.get(row.year)?.findCount ?? 0,
      entries: years.get(row.year)?.entries ?? []
    });
  }

  for (const row of findRows) {
    const existing = years.get(row.year);
    years.set(row.year, {
      year: row.year,
      eventCount: existing?.eventCount ?? 0,
      findCount: Number(row.count),
      entries: existing?.entries ?? []
    });
  }

  for (const row of eventListRows) {
    const existing = years.get(row.year);
    if (!existing) {
      continue;
    }

    existing.entries.push({
      id: row.id,
      kind: "event",
      title: row.title,
      date: String(row.event_date).slice(0, 10)
    });
  }

  for (const row of findListRows) {
    const existing = years.get(row.year);
    if (!existing) {
      continue;
    }

    existing.entries.push({
      id: row.id,
      kind: "find",
      title: row.title,
      date: String(row.find_date).slice(0, 10)
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
      count: prospectCount,
      entries: prospectListRows.map((row) => ({
        id: row.id,
        title: row.title,
        date: row.date_visited ? String(row.date_visited).slice(0, 10) : null
      }))
    }
  });
}
