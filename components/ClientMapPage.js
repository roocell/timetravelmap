"use client";

import dynamic from "next/dynamic";

const TimeTravelMap = dynamic(() => import("./TimeTravelMap"), {
  ssr: false
});

export default function ClientMapPage() {
  return <TimeTravelMap />;
}
