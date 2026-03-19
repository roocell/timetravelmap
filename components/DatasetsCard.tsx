"use client";

import { Database, MapPinned } from "lucide-react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

type DatasetYear = {
  year: number;
  eventCount: number;
  findCount: number;
};

type DatasetsCardProps = {
  years: DatasetYear[];
  prospectCount: number;
  loading?: boolean;
  activeYears: number[];
  prospectsActive: boolean;
  onToggleYear: (year: number) => void;
  onToggleProspects: () => void;
};

export default function DatasetsCard({
  years,
  prospectCount,
  loading = false,
  activeYears,
  prospectsActive,
  onToggleYear,
  onToggleProspects
}: DatasetsCardProps) {
  const activeButtonClass =
    "border-[rgba(11,34,45,0.92)] bg-gradient-to-b from-[#173745] to-[#0f2731] text-[#f3f8fa] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_32px_rgba(11,34,45,0.28)]";

  return (
    <Card className="mx-auto mt-[18px] max-w-[1400px]">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-[rgba(21,49,63,0.08)] bg-gradient-to-b from-[rgba(244,248,250,0.96)] to-[rgba(237,243,246,0.96)] px-[22px] py-[20px] md:flex-row md:items-end">
        <div className="inline-flex items-center gap-[10px] text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#15313f]">
          <Database size={16} strokeWidth={1.9} />
          <span>Data Sets</span>
        </div>
        <p className="m-0 text-[13px] text-[#5e727d]">
          {loading ? "Loading imported records..." : "Imported event, find, and prospect layers"}
        </p>
      </div>

      <div className="grid gap-3 p-[18px]">
        {years.map((yearEntry) => (
          <Button
            key={yearEntry.year}
            type="button"
            className={`w-full justify-between rounded-2xl px-[18px] py-4 max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-[6px] ${
              activeYears.includes(yearEntry.year) ? activeButtonClass : ""
            }`}
            onClick={() => onToggleYear(yearEntry.year)}
          >
            <span className="inline-flex items-center gap-[10px]">{yearEntry.year}</span>
            <span className="text-[13px] font-semibold text-[#60737e]">
              {yearEntry.eventCount > 0 ? `${yearEntry.eventCount} events` : null}
              {yearEntry.eventCount > 0 && yearEntry.findCount > 0 ? " · " : null}
              {yearEntry.findCount > 0 ? `${yearEntry.findCount} finds` : null}
            </span>
          </Button>
        ))}

        <Button
          type="button"
          className={`w-full justify-between rounded-2xl px-[18px] py-4 max-[700px]:flex-col max-[700px]:items-start max-[700px]:gap-[6px] ${
            prospectsActive ? activeButtonClass : ""
          }`}
          onClick={onToggleProspects}
        >
          <span className="inline-flex items-center gap-[10px]">
            <MapPinned size={16} strokeWidth={1.9} />
            <span>Prospects</span>
          </span>
          <span className="text-[13px] font-semibold text-[#60737e]">{prospectCount} records</span>
        </Button>
      </div>
    </Card>
  );
}
