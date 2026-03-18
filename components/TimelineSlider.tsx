"use client";

import { Clock3, SlidersHorizontal } from "lucide-react";
import { useRef } from "react";
import styles from "./TimelineSlider.module.css";

type TimelineSliderProps = {
  labels: Array<string | number>;
  max: number;
  value: number;
  onChange: (value: number) => void;
  reversed?: boolean;
};

export default function TimelineSlider({
  labels,
  max,
  value,
  onChange,
  reversed = false
}: TimelineSliderProps) {
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const orderedLabels = reversed ? [...labels].reverse() : labels;
  const currentLabel = orderedLabels[Math.round(value)] ?? orderedLabels[0];

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineHeader}>
        <div className={styles.timelineMeta}>
          <SlidersHorizontal size={16} strokeWidth={2} />
          <span>Timeline</span>
        </div>
        <div className={styles.timelineHint}>Drag to fade between years</div>
      </div>

      <div className={styles.sliderRow}>
        <div className={styles.trackGroup}>
          <div className={styles.sliderShell}>
            <input
              ref={sliderRef}
              className={styles.slider}
            type="range"
            min="0"
            max={max}
            step="any"
            value={value}
            onInput={(event) => onChange(Number.parseFloat(event.currentTarget.value))}
            aria-label="Map timeline"
          />
          </div>

          <div className={styles.sliderValues}>
            {orderedLabels.map((label) => (
              <span key={String(label)} className={styles.sliderValue}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.currentLabel}>
          <Clock3 size={15} strokeWidth={2} />
          <span>{currentLabel}</span>
        </div>
      </div>
    </div>
  );
}
