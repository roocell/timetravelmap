import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type YearCount = {
  year: number;
  count: bigint | number;
};

export async function GET() {
  const { prisma } = await import("../../../lib/prisma");
  const [eventRows, findRows, prospectCount] = await Promise.all([
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
    prisma.prospect.count()
  ]);

  const years = new Map<number, { year: number; eventCount: number; findCount: number }>();

  for (const row of eventRows) {
    years.set(row.year, {
      year: row.year,
      eventCount: Number(row.count),
      findCount: years.get(row.year)?.findCount ?? 0
    });
  }

  for (const row of findRows) {
    const existing = years.get(row.year);
    years.set(row.year, {
      year: row.year,
      eventCount: existing?.eventCount ?? 0,
      findCount: Number(row.count)
    });
  }

  return NextResponse.json({
    years: [...years.values()].sort((left, right) => right.year - left.year),
    prospects: {
      count: prospectCount
    }
  });
}
