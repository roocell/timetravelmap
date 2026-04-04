"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStackApp, useUser } from "@stackframe/stack";
import { canAccessApp } from "../lib/access";

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
  const stackApp = useStackApp();
  const user = useUser({ includeRestricted: true });
  const currentUserId = user?.id ?? null;
  const canUseApp = canAccessApp(user);
  const accessDenied = Boolean(user && !canUseApp);
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
    if (accessDenied) {
      if (!state.cancelled) {
        setDatasets({
          years: [],
          prospects: { count: 0, entries: [] },
          loading: false
        });
        setDatasetDebug({
          clientUserId: currentUserId,
          responseStatus: 403,
          responseOk: false,
          error: "Access denied",
          yearsCount: 0,
          prospectsCount: 0
        });
      }
      return;
    }

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
  }, [accessDenied, currentUserId]);

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

  if (accessDenied) {
    return (
      <main className="min-h-screen px-4 py-10 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.16)]">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              Approval Pending
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your account has signed in successfully, but access to the map is still pending.
            </p>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await user?.signOut();
                  await stackApp.redirectToHome();
                })();
              }}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

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
