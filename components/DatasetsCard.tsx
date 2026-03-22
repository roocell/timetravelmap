"use client";

import { ChevronDown, ChevronUp, Database, MapPinned, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

type DatasetYear = {
  year: number;
  eventCount: number;
  findCount: number;
  areaTotalM2?: number;
  entries: Array<{
    id: string;
    kind: "event" | "find";
    title: string;
    date: string;
    description: string | null;
  }>;
};

function formatAreaSummary(areaTotalM2?: number) {
  const area = Number(areaTotalM2 ?? 0);
  if (!Number.isFinite(area) || area <= 0) {
    return null;
  }

  if (area >= 10000) {
    return `${(area / 10000).toFixed(2)} ha`;
  }

  return `${Math.round(area).toLocaleString()} m²`;
}

type DatasetsCardProps = {
  years: DatasetYear[];
  prospectCount: number;
  prospectEntries: Array<{
    id: string;
    title: string;
    date: string | null;
    description: string | null;
  }>;
  loading?: boolean;
  debug?: {
    clientUserId: string | null;
    responseStatus: number | null;
    responseOk: boolean | null;
    error: string | null;
    yearsCount: number;
    prospectsCount: number;
  } | null;
  activeYears: number[];
  prospectsActive: boolean;
  onToggleYear: (year: number) => void;
  onSelectEntry: (year: number, entry: DatasetYear["entries"][number]) => void;
  onSelectProspect: (prospectId: string) => void;
  onToggleProspects: () => void;
};

export default function DatasetsCard({
  years,
  prospectCount,
  prospectEntries,
  loading = false,
  debug = null,
  activeYears,
  prospectsActive,
  onToggleYear,
  onSelectEntry,
  onSelectProspect,
  onToggleProspects
}: DatasetsCardProps) {
  const [expandedYears, setExpandedYears] = useState<number[]>([]);
  const [prospectsExpanded, setProspectsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const yearRowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const prospectsRowRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const activeButtonClass =
    "border-[rgba(11,34,45,0.92)] bg-gradient-to-b from-[#173745] to-[#0f2731] text-[#f3f8fa] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_32px_rgba(11,34,45,0.28)]";

  const filteredYears = useMemo(() => {
    if (!isSearching) {
      return years;
    }

    return years
      .map((yearEntry) => ({
        ...yearEntry,
        entries: yearEntry.entries.filter((entry) => {
          const haystack = `${entry.title} ${entry.description ?? ""}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      }))
      .filter((yearEntry) => yearEntry.entries.length > 0);
  }, [years, isSearching, normalizedQuery]);

  const filteredProspectEntries = useMemo(() => {
    if (!isSearching) {
      return prospectEntries;
    }

    return prospectEntries.filter((entry) => {
      const haystack = `${entry.title} ${entry.description ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [prospectEntries, isSearching, normalizedQuery]);

  const showProspects = isSearching
    ? filteredProspectEntries.length > 0
    : prospectCount > 0 || prospectEntries.length > 0;

  const toggleExpandedYear = (year: number) => {
    const row = yearRowRefs.current[year];
    const beforeTop = row?.getBoundingClientRect().top ?? null;

    setExpandedYears((current) =>
      current.includes(year) ? current.filter((entry) => entry !== year) : [...current, year]
    );

    if (beforeTop !== null) {
      window.requestAnimationFrame(() => {
        const updatedRow = yearRowRefs.current[year];
        const afterTop = updatedRow?.getBoundingClientRect().top ?? null;
        if (afterTop === null) {
          return;
        }

        window.scrollBy(0, afterTop - beforeTop);
      });
    }
  };

  const toggleProspectsExpanded = () => {
    const beforeTop = prospectsRowRef.current?.getBoundingClientRect().top ?? null;
    setProspectsExpanded((current) => !current);

    if (beforeTop !== null) {
      window.requestAnimationFrame(() => {
        const afterTop = prospectsRowRef.current?.getBoundingClientRect().top ?? null;
        if (afterTop === null) {
          return;
        }

        window.scrollBy(0, afterTop - beforeTop);
      });
    }
  };

  return (
    <Card className="mx-auto mt-[18px] max-w-[1400px]">
      <div className="flex flex-wrap items-center gap-4 border-b border-[rgba(21,49,63,0.08)] bg-gradient-to-b from-[rgba(244,248,250,0.96)] to-[rgba(237,243,246,0.96)] px-[22px] py-[20px]">
        <div className="inline-flex shrink-0 items-center gap-[10px] text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#15313f]">
          <Database size={16} strokeWidth={1.9} />
          <span>Data Sets</span>
        </div>
        <label className="relative mx-auto min-w-[280px] max-w-[420px] flex-1">
          <Search
            size={15}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6a7d88]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder="Search titles and descriptions"
            className="w-full rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white/90 py-2.5 pl-10 pr-10 text-[14px] text-[#15313f] outline-none placeholder:text-[#7b8d97]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#6a7d88] transition hover:bg-[rgba(21,49,63,0.08)] hover:text-[#15313f]"
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={2.2} />
            </button>
          ) : null}
        </label>
        <p className="m-0 ml-auto shrink-0 text-right text-[13px] text-[#5e727d] max-[700px]:hidden">
          Event, Finds, Prospects Layers
        </p>
      </div>

      <div className="grid gap-3 p-[18px]">
        {debug?.error ? (
          <div className="rounded-2xl border border-[rgba(180,60,20,0.16)] bg-[rgba(255,248,244,0.92)] px-4 py-3 font-mono text-[12px] text-[#7a3e21]">
            <div>clientUserId: {debug.clientUserId ?? "null"}</div>
            <div>responseStatus: {debug.responseStatus ?? "null"}</div>
            <div>responseOk: {debug.responseOk === null ? "null" : String(debug.responseOk)}</div>
            <div>yearsCount: {debug.yearsCount}</div>
            <div>prospectsCount: {debug.prospectsCount}</div>
            <div>error: {debug.error}</div>
          </div>
        ) : null}

        {filteredYears.map((yearEntry) => {
          const isExpanded = isSearching ? true : expandedYears.includes(yearEntry.year);
          const isActive = activeYears.includes(yearEntry.year);
          const areaSummary = formatAreaSummary(yearEntry.areaTotalM2);

          return (
            <div
              key={yearEntry.year}
              ref={(node) => {
                yearRowRefs.current[yearEntry.year] = node;
              }}
              className="overflow-hidden rounded-2xl border border-[rgba(21,49,63,0.08)] bg-white/70"
            >
              <div className="flex items-stretch">
                <Button
                  type="button"
                  className={`flex-1 justify-between rounded-none border-0 px-[18px] py-4 max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-[6px] ${
                    isActive ? activeButtonClass : ""
                  }`}
                  onClick={() => onToggleYear(yearEntry.year)}
                >
                  <span className="inline-flex items-center gap-[10px]">{yearEntry.year}</span>
                  <span className="text-[13px] font-semibold text-[#60737e]">
                    {yearEntry.eventCount > 0 ? `${yearEntry.eventCount} events` : null}
                    {yearEntry.eventCount > 0 && yearEntry.findCount > 0 ? " · " : null}
                    {yearEntry.findCount > 0 ? `${yearEntry.findCount} finds` : null}
                    {areaSummary ? " · " : null}
                    {areaSummary}
                  </span>
                </Button>

                <button
                  type="button"
                  onClick={() => toggleExpandedYear(yearEntry.year)}
                  className="inline-flex w-14 shrink-0 items-center justify-center border-l border-[rgba(21,49,63,0.08)] bg-[rgba(244,248,250,0.95)] text-[#526773] transition hover:bg-[rgba(235,242,246,0.98)]"
                  aria-label={`${isExpanded ? "Hide" : "Show"} ${yearEntry.year} entries`}
                >
                  {isExpanded ? (
                    <ChevronUp size={18} strokeWidth={2.2} />
                  ) : (
                    <ChevronDown size={18} strokeWidth={2.2} />
                  )}
                </button>
              </div>

              {isExpanded ? (
                <div className="border-t border-[rgba(21,49,63,0.08)] bg-[rgba(247,250,252,0.96)] px-4 py-3">
                  <div className="grid gap-2">
                    {yearEntry.entries.map((entry) => (
                      <button
                        type="button"
                        key={`${entry.kind}-${entry.id}`}
                        onClick={() => onSelectEntry(yearEntry.year, entry)}
                        className="flex w-full items-start justify-between gap-4 rounded-xl border border-[rgba(21,49,63,0.06)] bg-white/80 px-3 py-2 text-left transition hover:bg-white"
                      >
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold text-[#15313f]">
                            {entry.title}
                          </div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
                            {entry.kind}
                          </div>
                        </div>
                        <div className="shrink-0 text-[12px] font-semibold text-[#526773]">
                          {entry.date}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {showProspects ? (
          <div
            ref={prospectsRowRef}
            className="overflow-hidden rounded-2xl border border-[rgba(21,49,63,0.08)] bg-white/70"
          >
            <div className="flex items-stretch">
              <Button
                type="button"
                className={`flex-1 justify-between rounded-none border-0 px-[18px] py-4 max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-[6px] ${
                  prospectsActive ? activeButtonClass : ""
                }`}
                onClick={onToggleProspects}
              >
                <span className="inline-flex items-center gap-[10px]">
                  <MapPinned size={16} strokeWidth={1.9} />
                  <span>Prospects</span>
                </span>
                <span className="text-[13px] font-semibold text-[#60737e]">
                  {isSearching ? filteredProspectEntries.length : prospectCount} records
                </span>
              </Button>

              <button
                type="button"
                onClick={toggleProspectsExpanded}
                className="inline-flex w-14 shrink-0 items-center justify-center border-l border-[rgba(21,49,63,0.08)] bg-[rgba(244,248,250,0.95)] text-[#526773] transition hover:bg-[rgba(235,242,246,0.98)]"
                aria-label={`${(isSearching || prospectsExpanded) ? "Hide" : "Show"} prospect entries`}
              >
                {isSearching || prospectsExpanded ? (
                  <ChevronUp size={18} strokeWidth={2.2} />
                ) : (
                  <ChevronDown size={18} strokeWidth={2.2} />
                )}
              </button>
            </div>

            {isSearching || prospectsExpanded ? (
              <div className="border-t border-[rgba(21,49,63,0.08)] bg-[rgba(247,250,252,0.96)] px-4 py-3">
                <div className="grid gap-2">
                  {filteredProspectEntries.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      onClick={() => onSelectProspect(entry.id)}
                      className="flex w-full items-start justify-between gap-4 rounded-xl border border-[rgba(21,49,63,0.06)] bg-white/80 px-3 py-2 text-left transition hover:bg-white"
                    >
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-[#15313f]">
                          {entry.title}
                        </div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
                          prospect
                        </div>
                      </div>
                      <div className="shrink-0 text-[12px] font-semibold text-[#526773]">
                        {entry.date ?? "No date"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {isSearching && filteredYears.length === 0 && filteredProspectEntries.length === 0 ? (
          <div className="rounded-2xl border border-[rgba(21,49,63,0.08)] bg-white/70 px-4 py-5 text-[14px] text-[#5e727d]">
            No matching items found.
          </div>
        ) : null}
      </div>
    </Card>
  );
}
