"use client";

import {
  ChevronDown,
  ChevronUp,
  Database,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  MapPinned,
  Plus,
  Search,
  Settings,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

  if (area >= 1_000_000) {
    return `${(area / 1_000_000).toFixed(2)} km²`;
  }

  return `${Math.round(area)} m²`;
}

const TILESET_SUFFIX = "/{z}/{x}/{y}.png";
const ARCGIS_TILE_SUFFIX = "/tile/{z}/{y}/{x}";
const ARCGIS_MAPSERVER_MARKER = "/MapServer";
type TilesetProviderType = "xyz" | "arcgis" | "wms";
type TilesetDraft = {
  id?: string;
  name: string;
  type: TilesetProviderType;
  url: string;
  visible: boolean;
};

function stripArcGisTilePath(value: string) {
  const normalized = value.replace(/\/+$/, "");
  const mapServerIndex = normalized.toLowerCase().indexOf(ARCGIS_MAPSERVER_MARKER.toLowerCase());
  if (mapServerIndex === -1) {
    return normalized;
  }

  return normalized.slice(0, mapServerIndex + ARCGIS_MAPSERVER_MARKER.length);
}

function normalizeTilesetInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutXyzSuffix = trimmed.endsWith(TILESET_SUFFIX)
    ? trimmed.slice(0, -TILESET_SUFFIX.length)
    : trimmed;
  const withoutArcGisTemplate = withoutXyzSuffix.endsWith(ARCGIS_TILE_SUFFIX)
    ? withoutXyzSuffix.slice(0, -ARCGIS_TILE_SUFFIX.length)
    : withoutXyzSuffix;
  const withoutArcGisTilePath = stripArcGisTilePath(withoutArcGisTemplate);

  return withoutArcGisTilePath.replace(/\/+$/, "");
}

function normalizeTilesetType(value: unknown, url: string): TilesetProviderType {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "xyz" || normalized === "arcgis" || normalized === "wms") {
    return normalized;
  }

  if (url.toLowerCase().includes(ARCGIS_MAPSERVER_MARKER.toLowerCase())) {
    return "arcgis";
  }

  if (url.toLowerCase().includes("service=wms") || url.toLowerCase().includes("layers=")) {
    return "wms";
  }

  return "xyz";
}

function normalizeTilesetDraft(tileset?: {
  id?: string;
  name?: string | null;
  type?: TilesetProviderType;
  visible?: boolean;
  url?: string;
}) {
  const url = normalizeTilesetInput(String(tileset?.url ?? ""));
  return {
    id: tileset?.id,
    name: String(tileset?.name ?? ""),
    type: normalizeTilesetType(tileset?.type, url),
    visible: tileset?.visible !== false,
    url
  } satisfies TilesetDraft;
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
  tilesets: Array<{
    id: string;
    name?: string | null;
    type?: TilesetProviderType;
    visible?: boolean;
    url: string;
    sortOrder?: number;
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
  onTilesetsSaved: (tilesets: Array<{
    id: string;
    name?: string | null;
    type?: TilesetProviderType;
    visible?: boolean;
    url: string;
    sortOrder?: number;
  }>) => void;
  onToggleYear: (year: number) => void;
  onSelectEntry: (year: number, entry: DatasetYear["entries"][number]) => void;
  onSelectProspect: (prospectId: string) => void;
  onToggleProspects: () => void;
};

export default function DatasetsCard({
  years,
  prospectCount,
  prospectEntries,
  tilesets,
  loading = false,
  debug = null,
  activeYears,
  prospectsActive,
  onTilesetsSaved,
  onToggleYear,
  onSelectEntry,
  onSelectProspect,
  onToggleProspects
}: DatasetsCardProps) {
  const [expandedYears, setExpandedYears] = useState<number[]>([]);
  const [prospectsExpanded, setProspectsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tilesetInputs, setTilesetInputs] = useState<TilesetDraft[]>(() =>
    tilesets.length > 0
      ? tilesets.map((tileset) => normalizeTilesetDraft(tileset))
      : [{ name: "", type: "xyz", url: "", visible: true }]
  );
  const [savedTilesetInputs, setSavedTilesetInputs] = useState<TilesetDraft[]>(() =>
    tilesets.length > 0 ? tilesets.map((tileset) => normalizeTilesetDraft(tileset)) : []
  );
  const [tilesetsSaving, setTilesetsSaving] = useState(false);
  const [tilesetsError, setTilesetsError] = useState<string | null>(null);
  const [draggedTilesetIndex, setDraggedTilesetIndex] = useState<number | null>(null);
  const [dragArmedIndex, setDragArmedIndex] = useState<number | null>(null);
  const [tilesetHelpOpen, setTilesetHelpOpen] = useState(false);
  const yearRowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const prospectsRowRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const activeButtonClass =
    "border-[rgba(11,34,45,0.92)] bg-gradient-to-b from-[#173745] to-[#0f2731] text-[#f3f8fa] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_32px_rgba(11,34,45,0.28)]";

  useEffect(() => {
    setTilesetInputs(
      tilesets.length > 0
        ? tilesets.map((tileset) => normalizeTilesetDraft(tileset))
        : [{ name: "", type: "xyz", url: "", visible: true }]
    );
    setSavedTilesetInputs(tilesets.map((tileset) => normalizeTilesetDraft(tileset)));
  }, [tilesets]);

  const sortEntriesByDate = <T extends { date: string | null; title: string }>(entries: T[]) =>
    [...entries].sort((left, right) => {
      const leftDate = left.date ?? "9999-12-31";
      const rightDate = right.date ?? "9999-12-31";

      if (leftDate !== rightDate) {
        return rightDate.localeCompare(leftDate);
      }

      return left.title.localeCompare(right.title);
    });

  const filteredYears = useMemo(() => {
    if (!isSearching) {
      return years.map((yearEntry) => ({
        ...yearEntry,
        entries: sortEntriesByDate(yearEntry.entries)
      }));
    }

    return years
      .map((yearEntry) => ({
        ...yearEntry,
        entries: sortEntriesByDate(
          yearEntry.entries.filter((entry) => {
            const haystack = `${entry.title} ${entry.description ?? ""}`.toLowerCase();
            return haystack.includes(normalizedQuery);
          })
        )
      }))
      .filter((yearEntry) => yearEntry.entries.length > 0);
  }, [years, isSearching, normalizedQuery]);

  const filteredProspectEntries = useMemo(() => {
    if (!isSearching) {
      return sortEntriesByDate(prospectEntries);
    }

    return sortEntriesByDate(
      prospectEntries.filter((entry) => {
        const haystack = `${entry.title} ${entry.description ?? ""}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    );
  }, [prospectEntries, isSearching, normalizedQuery]);

  const showProspects = isSearching
    ? filteredProspectEntries.length > 0
    : prospectCount > 0 || prospectEntries.length > 0;
  const normalizedTilesetInputs = tilesetInputs
    .map((tileset) => ({
      name: tileset.name.trim(),
      type: tileset.type,
      visible: tileset.visible,
      url: normalizeTilesetInput(tileset.url)
    }))
    .filter((tileset) => tileset.url);
  const normalizedTilesets = savedTilesetInputs
    .map((tileset) => ({
      name: tileset.name.trim(),
      type: tileset.type,
      visible: tileset.visible,
      url: normalizeTilesetInput(tileset.url)
    }))
    .filter((tileset) => tileset.url);
  const tilesetsChanged =
    normalizedTilesetInputs.length !== normalizedTilesets.length ||
    normalizedTilesetInputs.some((tileset, index) => {
      const saved = normalizedTilesets[index];
      return (
        !saved ||
        tileset.name !== saved.name ||
        tileset.type !== saved.type ||
        tileset.visible !== saved.visible ||
        tileset.url !== saved.url
      );
    });

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

  const updateTilesetInput = (
    index: number,
    field: keyof Pick<TilesetDraft, "name" | "type" | "url" | "visible">,
    nextValue: string | boolean
  ) => {
    setTilesetInputs((current) =>
      current.map((value, entryIndex) =>
        entryIndex === index
          ? {
              ...value,
              [field]: nextValue
            }
          : value
      )
    );
    setTilesetsError(null);
  };

  const addTilesetInput = () => {
    setTilesetInputs((current) => {
      const next = [...current];
      next.push({ name: "", type: "xyz", url: "", visible: true });
      return next;
    });
    setTilesetsError(null);
  };

  const moveTilesetInput = (fromIndex: number, toIndex: number) => {
    setTilesetInputs((current) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length ||
        fromIndex === toIndex
      ) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setTilesetsError(null);
  };

  const saveTilesets = async () => {
    setTilesetsSaving(true);
    setTilesetsError(null);

    try {
      const response = await fetch("/api/settings/tilesets", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          tilesets: tilesetInputs
            .map((tileset) => ({
              name: tileset.name.trim() || null,
              type: tileset.type,
              visible: tileset.visible,
              url: normalizeTilesetInput(tileset.url)
            }))
            .filter((tileset) => tileset.url)
        })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          `Failed to save tilesets (${response.status})${payload?.error ? `: ${payload.error}` : ""}`
        );
      }

      setTilesetInputs(
        Array.isArray(payload?.tilesets) && payload.tilesets.length > 0
          ? payload.tilesets.map((tileset: TilesetDraft) => normalizeTilesetDraft(tileset))
          : [{ name: "", type: "xyz", url: "", visible: true }]
      );
      setSavedTilesetInputs(
        Array.isArray(payload?.tilesets)
          ? payload.tilesets.map((tileset: TilesetDraft) => normalizeTilesetDraft(tileset))
          : []
      );
      onTilesetsSaved(Array.isArray(payload?.tilesets) ? payload.tilesets : []);
    } catch (error) {
      setTilesetsError(
        error instanceof Error ? error.message : "Failed to save tilesets"
      );
    } finally {
      setTilesetsSaving(false);
    }
  };

  return (
    <>
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

      <Card className="mx-auto mt-4 max-w-[1400px]">
        <div className="border-b border-[rgba(21,49,63,0.08)] bg-gradient-to-b from-[rgba(244,248,250,0.96)] to-[rgba(237,243,246,0.96)] px-[22px] py-[20px]">
          <div className="inline-flex items-center gap-[10px] text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#15313f]">
            <Settings size={16} strokeWidth={1.9} />
            <span>Settings</span>
          </div>
        </div>

        <div className="grid gap-4 p-[18px]">
          <div className="overflow-hidden rounded-2xl border border-[rgba(21,49,63,0.08)] bg-white/70">
            <div className="grid gap-4 px-[18px] py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-[14px] font-semibold text-[#15313f]">Tilesets</div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setTilesetHelpOpen((current) => !current)}
                        onBlur={() => {
                          window.setTimeout(() => {
                            setTilesetHelpOpen(false);
                          }, 120);
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(21,49,63,0.12)] bg-white/90 text-[#60737e] transition hover:bg-[rgba(244,248,250,0.95)] hover:text-[#15313f]"
                        aria-label="Tileset help"
                        title="Tileset help"
                      >
                        <Info size={13} strokeWidth={2.3} />
                      </button>
                      <div
                        className={`absolute left-0 top-[calc(100%+8px)] z-20 w-[340px] rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[12px] leading-5 text-[#60737e] shadow-[0_18px_48px_rgba(21,49,63,0.16)] ${tilesetHelpOpen ? "block" : "hidden"}`}
                      >
                        <div>Add custom tileset base URLs for your account.</div>
                        <div className="mt-1">
                          PNG: use a base tileset URL like <code>https://your-domain.com/tiles/1879</code>{" "}
                          and leave off <code>/{"{z}"}/{"{x}"}/{"{y}"}.png</code>.
                        </div>
                        <div className="mt-1">
                          ArcGIS: use the base <code>/MapServer</code> URL and leave off{" "}
                          <code>/tile/{"{z}"}/{"{y}"}/{"{x}"}</code>.
                        </div>
                        <div className="mt-1">
                          WMS: use the full service URL with query params such as{" "}
                          <code>service=WMS&amp;layers=...</code>.
                        </div>
                        <div className="mt-1">
                          To remove an entry, delete the URL and save.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    void saveTilesets();
                  }}
                  disabled={tilesetsSaving || !tilesetsChanged}
                  className="shrink-0"
                >
                  {tilesetsSaving ? "Saving..." : "Save"}
                </Button>
              </div>

              <div className="grid gap-2">
                {tilesetInputs.map((value, index) => (
                  <div
                    key={`tileset-${index}`}
                    className={`flex items-center gap-2 rounded-xl border border-[rgba(21,49,63,0.06)] bg-[rgba(248,251,252,0.7)] px-2.5 py-2 max-[900px]:flex-wrap ${draggedTilesetIndex === index ? "opacity-60" : ""}`}
                    draggable={dragArmedIndex === index}
                    onDragStart={(event) => {
                      if (dragArmedIndex !== index) {
                        event.preventDefault();
                        return;
                      }

                      setDraggedTilesetIndex(index);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedTilesetIndex === null) {
                        return;
                      }

                      moveTilesetInput(draggedTilesetIndex, index);
                      setDraggedTilesetIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggedTilesetIndex(null);
                      setDragArmedIndex(null);
                    }}
                  >
                    <div
                      onMouseDown={() => {
                        setDragArmedIndex(index);
                      }}
                      onMouseUp={() => {
                        setDragArmedIndex((current) => (current === index ? null : current));
                      }}
                      onMouseLeave={() => {
                        setDragArmedIndex((current) => (current === index ? null : current));
                      }}
                      className="inline-flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-xl border border-[rgba(21,49,63,0.1)] bg-white/90 text-[#526773] active:cursor-grabbing"
                      aria-label="Drag to reorder tileset"
                      title="Drag to reorder"
                    >
                      <GripVertical size={16} strokeWidth={2.2} />
                    </div>
                    <button
                      type="button"
                      onClick={() => updateTilesetInput(index, "visible", !value.visible)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(21,49,63,0.1)] bg-white/90 text-[#15313f] transition hover:bg-[rgba(244,248,250,0.95)]"
                      aria-label={value.visible ? "Hide tileset from timeline" : "Show tileset in timeline"}
                      title={value.visible ? "Visible in timeline" : "Hidden from timeline"}
                    >
                      {value.visible ? <Eye size={16} strokeWidth={2.2} /> : <EyeOff size={16} strokeWidth={2.2} />}
                    </button>
                    <input
                      type="text"
                      value={value.name}
                      onChange={(event) => updateTilesetInput(index, "name", event.currentTarget.value)}
                      placeholder="Name"
                      maxLength={10}
                      className="w-[112px] rounded-xl border border-[rgba(21,49,63,0.1)] bg-white/92 px-3 py-2 text-[13px] text-[#15313f] outline-none placeholder:text-[#7b8d97] max-[900px]:w-full"
                    />
                    <select
                      value={value.type}
                      onChange={(event) =>
                        updateTilesetInput(index, "type", event.currentTarget.value as TilesetProviderType)
                      }
                      className="w-[104px] shrink-0 rounded-xl border border-[rgba(21,49,63,0.1)] bg-white/92 px-3 py-2 text-[13px] text-[#15313f] outline-none"
                    >
                      <option value="xyz">XYZ</option>
                      <option value="arcgis">ArcGIS</option>
                      <option value="wms">WMS</option>
                    </select>
                    <input
                      type="text"
                      value={value.url}
                      onChange={(event) => updateTilesetInput(index, "url", event.currentTarget.value)}
                      placeholder={
                        value.type === "wms"
                          ? "https://example.com/wms?service=WMS&layers=layer-name&format=image/png"
                          : value.type === "arcgis"
                            ? "https://example.com/arcgis/rest/services/LayerName/MapServer"
                            : "https://example.com/tiles/1879"
                      }
                      className="min-w-0 flex-1 rounded-xl border border-[rgba(21,49,63,0.1)] bg-white/92 px-3 py-2 text-[13px] text-[#15313f] outline-none placeholder:text-[#7b8d97] max-[900px]:w-full"
                    />
                  </div>
                ))}
              </div>

            <button
              type="button"
              onClick={() => addTilesetInput()}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-[rgba(21,49,63,0.1)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#15313f] transition hover:bg-[rgba(244,248,250,0.95)]"
            >
              <Plus size={16} strokeWidth={2.4} />
              <span>Add tileset</span>
            </button>

            {tilesetsError ? (
              <div className="rounded-2xl border border-[rgba(180,60,20,0.16)] bg-[rgba(255,248,244,0.92)] px-4 py-3 text-[12px] text-[#7a3e21]">
                  {tilesetsError}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
