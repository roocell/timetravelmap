"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@stackframe/stack";

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
  const user = useUser();
  const currentUserId = user?.id ?? null;
  const [activeYears, setActiveYears] = useState(() => loadDatasetState().activeYears);
  const [prospectsActive, setProspectsActive] = useState(
    () => loadDatasetState().prospectsActive
  );
  const [datasets, setDatasets] = useState({
    years: [],
    prospects: { count: 0, entries: [] },
    loading: true
  });
  const [datasetDebug, setDatasetDebug] = useState({
    clientUserId: null,
    responseStatus: null,
    responseOk: null,
    error: null,
    yearsCount: 0,
    prospectsCount: 0
  });

  const loadDatasets = async (state = { cancelled: false }) => {
    if (!currentUserId) {
      if (!state.cancelled) {
        setDatasets({
          years: [],
          prospects: { count: 0, entries: [] },
          loading: false
        });
        setDatasetDebug({
          clientUserId: null,
          responseStatus: null,
          responseOk: null,
          error: "No client user",
          yearsCount: 0,
          prospectsCount: 0
        });
      }
      return;
    }

    try {
      const response = await fetch("/api/datasets", {
        cache: "no-store"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          `Failed to load datasets (${response.status})${payload?.error ? `: ${payload.error}` : ""}`
        );
      }

      if (!state.cancelled) {
        setDatasets({
          years: payload.years ?? [],
          prospects: payload.prospects ?? { count: 0, entries: [] },
          loading: false
        });
        setDatasetDebug({
          clientUserId: currentUserId,
          responseStatus: response.status,
          responseOk: response.ok,
          error: null,
          yearsCount: Array.isArray(payload.years) ? payload.years.length : 0,
          prospectsCount: payload.prospects?.count ?? 0
        });
      }
    } catch (error) {
      if (!state.cancelled) {
        setDatasets({
          years: [],
          prospects: { count: 0, entries: [] },
          loading: false
        });
        setDatasetDebug({
          clientUserId: currentUserId,
          responseStatus: null,
          responseOk: false,
          error: error instanceof Error ? error.message : "Unknown datasets error",
          yearsCount: 0,
          prospectsCount: 0
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
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setActiveYears([]);
      setProspectsActive(false);
    }
  }, [currentUserId]);

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
      datasetDebug={datasetDebug}
      onDatasetsChanged={() => loadDatasets()}
      onToggleYear={toggleYear}
      onToggleProspects={() => setProspectsActive((current) => !current)}
    />
  );
}
