import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EventRow = {
  id: string;
  title: string;
  event_date: Date | string;
  description: string | null;
  fill_color: string | null;
  outline_color: string | null;
  outline_width: number | string | null;
  geojson: string;
};

type FindRow = {
  id: string;
  title: string;
  find_date: Date | string;
  description: string | null;
  type: string;
  metal: string | null;
  item_count: number | null;
  latitude: number;
  longitude: number;
};

type ProspectRow = {
  id: string;
  title: string;
  description: string | null;
  age_label: string | null;
  date_visited: Date | string | null;
  latitude: number;
  longitude: number;
};

export async function GET(request: NextRequest) {
  const { prisma } = await import("../../../../lib/prisma");
  const yearParam = request.nextUrl.searchParams.get("year");
  const dataset = request.nextUrl.searchParams.get("dataset");

  if (dataset === "prospects") {
    const prospects = await prisma.$queryRaw<ProspectRow[]>`
      select
        id,
        title,
        description,
        age_label,
        date_visited,
        latitude,
        longitude
      from timetravelmap.prospects
      order by title asc
    `;

    return NextResponse.json({
      type: "prospects",
      prospects: prospects.map((prospect) => ({
        id: prospect.id,
        title: prospect.title,
        description: prospect.description,
        ageLabel: prospect.age_label,
        dateVisited: prospect.date_visited,
        latitude: prospect.latitude,
        longitude: prospect.longitude
      }))
    });
  }

  const year = Number.parseInt(yearParam ?? "", 10);
  if (!Number.isFinite(year)) {
    return NextResponse.json({ error: "Missing or invalid year" }, { status: 400 });
  }

  const [events, finds] = await Promise.all([
    prisma.$queryRaw<EventRow[]>`
      select
        id,
        title,
        event_date,
        description,
        fill_color,
        outline_color,
        outline_width,
        ST_AsGeoJSON(area) as geojson
      from timetravelmap.events
      where extract(year from event_date)::int = ${year}
      order by event_date asc, title asc
    `,
    prisma.$queryRaw<FindRow[]>`
      select
        id,
        title,
        find_date,
        description,
        type,
        metal,
        item_count,
        latitude,
        longitude
      from timetravelmap.finds
      where extract(year from find_date)::int = ${year}
      order by find_date asc, title asc
    `
  ]);

  return NextResponse.json({
    type: "year",
    year,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      eventDate: event.event_date,
      description: event.description,
      fillColor: event.fill_color,
      outlineColor: event.outline_color,
      outlineWidth:
        event.outline_width === null ? null : Number(event.outline_width),
      geometry: JSON.parse(event.geojson)
    })),
    finds: finds.map((find) => ({
      id: find.id,
      title: find.title,
      findDate: find.find_date,
      description: find.description,
      type: find.type,
      metal: find.metal,
      itemCount: find.item_count,
      latitude: find.latitude,
      longitude: find.longitude
    }))
  });
}
