"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const TimeTravelMap = dynamic(() => import("./TimeTravelMap"), {
  ssr: false
});

export default function ClientMapPage() {
  const [activeYears, setActiveYears] = useState([]);
  const [prospectsActive, setProspectsActive] = useState(false);
  const [datasets, setDatasets] = useState({
    years: [],
    prospects: { count: 0 },
    loading: true
  });

  useEffect(() => {
    let cancelled = false;

    const loadDatasets = async () => {
      try {
        const response = await fetch("/api/datasets");
        if (!response.ok) {
          throw new Error("Failed to load datasets");
        }

        const payload = await response.json();
        if (!cancelled) {
          setDatasets({
            years: payload.years ?? [],
            prospects: payload.prospects ?? { count: 0 },
            loading: false
          });
        }
      } catch {
        if (!cancelled) {
          setDatasets({
            years: [],
            prospects: { count: 0 },
            loading: false
          });
        }
      }
    };

    loadDatasets();

    return () => {
      cancelled = true;
    };
  }, []);

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
      onToggleYear={toggleYear}
      onToggleProspects={() => setProspectsActive((current) => !current)}
    />
  );
}
