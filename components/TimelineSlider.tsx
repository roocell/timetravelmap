"use client";

import { Clock3, SlidersHorizontal } from "lucide-react";
import { useRef } from "react";

type TimelineSliderProps = {
  labels: Array<string | number>;
  max: number;
  value: number;
  onChange: (value: number) => void;
  reversed?: boolean;
  disabled?: boolean;
};

export default function TimelineSlider({
  labels,
  max,
  value,
  onChange,
  reversed = false,
  disabled = false
}: TimelineSliderProps) {
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const orderedLabels = reversed ? [...labels].reverse() : labels;
  const currentLabel = orderedLabels[Math.round(value)] ?? orderedLabels[0];

  return (
    <div className="grid gap-3 border-t border-[rgba(21,49,63,0.08)] bg-gradient-to-b from-[rgba(247,250,252,0.94)] to-[rgba(240,245,248,0.94)] px-6 pb-5 pt-4 max-[700px]:gap-3 max-[700px]:px-4 max-[700px]:pb-4 max-[700px]:pt-[14px]">
      <div className="flex items-center justify-between gap-4 max-[700px]:flex-col max-[700px]:items-start">
        <div className="inline-flex items-center gap-2.5 text-[14px] font-bold text-[#15313f]">
          <SlidersHorizontal size={16} strokeWidth={2} />
          <span>Timeline</span>
        </div>
        <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#6a7d88] max-[700px]:hidden">
          {disabled ? "Locked for restricted users" : "Drag to fade between years"}
        </div>
      </div>

      <div className="flex items-center justify-between gap-6 max-[700px]:gap-3">
        <div className="min-w-0 flex-1">
          <div className="w-full">
            <input
              ref={sliderRef}
              className={`h-[10px] w-full appearance-none rounded-md bg-[rgba(21,49,63,0.16)] outline-none [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#15313f] [&::-moz-range-thumb]:shadow-[0_4px_12px_rgba(21,49,63,0.22)] [&::-moz-range-track]:h-[10px] [&::-moz-range-track]:rounded-md [&::-moz-range-track]:bg-[rgba(21,49,63,0.16)] [&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#15313f] [&::-webkit-slider-thumb]:shadow-[0_4px_12px_rgba(21,49,63,0.22)] ${disabled ? "cursor-not-allowed opacity-60 [&::-moz-range-thumb]:cursor-not-allowed [&::-webkit-slider-thumb]:cursor-not-allowed" : "[&::-moz-range-thumb]:cursor-pointer [&::-webkit-slider-thumb]:cursor-pointer"}`}
              type="range"
              min="0"
              max={max}
              step="any"
              value={value}
              disabled={disabled}
              onInput={(event) => onChange(Number.parseFloat(event.currentTarget.value))}
              aria-label={disabled ? "Map timeline locked" : "Map timeline"}
            />
          </div>

          <div className="flex justify-between gap-3 overflow-x-auto pb-1 text-[13px] font-bold text-[#526773] max-[700px]:hidden">
            {orderedLabels.map((label) => (
              <span key={String(label)} className="whitespace-nowrap">
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="inline-flex min-w-24 shrink-0 items-center justify-end gap-2 text-right text-[13px] font-bold text-[#15313f] max-[700px]:min-w-fit">
          <Clock3 size={15} strokeWidth={2} />
          <span>{currentLabel}</span>
        </div>
      </div>
    </div>
  );
}
