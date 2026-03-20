"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const DATASET_STATE_KEY = "ttm.dataset-state";

const TimeTravelMap = dynamic(() => import("./TimeTravelMap"), {
  ssr: false
});

function loadDatasetState() {
  if (typeof window === "undefined") {
    return {
      activeYears: [],
      prospectsActive: false
    };
  }

  try {
    const raw = window.localStorage.getItem(DATASET_STATE_KEY);
    if (!raw) {
      return {
        activeYears: [],
        prospectsActive: false
      };
    }

    const parsed = JSON.parse(raw);
    return {
      activeYears: Array.isArray(parsed.activeYears)
        ? parsed.activeYears.filter((year) => Number.isFinite(year))
        : [],
      prospectsActive: Boolean(parsed.prospectsActive)
    };
  } catch {
    return {
      activeYears: [],
      prospectsActive: false
    };
  }
}

export default function ClientMapPage() {
  const [activeYears, setActiveYears] = useState(() => loadDatasetState().activeYears);
  const [prospectsActive, setProspectsActive] = useState(
    () => loadDatasetState().prospectsActive
  );
  const [datasets, setDatasets] = useState({
    years: [],
    prospects: { count: 0, entries: [] },
    loading: true
  });

  const loadDatasets = async (state = { cancelled: false }) => {
    try {
      const response = await fetch("/api/datasets");
      if (!response.ok) {
        throw new Error("Failed to load datasets");
      }

      const payload = await response.json();
      if (!state.cancelled) {
        setDatasets({
          years: payload.years ?? [],
          prospects: payload.prospects ?? { count: 0, entries: [] },
          loading: false
        });
      }
    } catch {
      if (!state.cancelled) {
        setDatasets({
          years: [],
          prospects: { count: 0, entries: [] },
          loading: false
        });
      }
    }
  };

  useEffect(() => {
    const state = { cancelled: false };
    void loadDatasets(state);

    return () => {
      state.cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      DATASET_STATE_KEY,
      JSON.stringify({
        activeYears,
        prospectsActive
      })
    );
  }, [activeYears, prospectsActive]);

  const toggleYear = (year) => {
    setActiveYears((current) =>
      current.includes(year) ? current.filter((entry) => entry !== year) : [...current, year]
    );
  };

  return (
    <TimeTravelMap
      datasets={datasets}
      activeYears={activeYears}
      prospectsActive={prospectsActive}
      onDatasetsChanged={() => loadDatasets()}
      onToggleYear={toggleYear}
      onToggleProspects={() => setProspectsActive((current) => !current)}
    />
  );
}
