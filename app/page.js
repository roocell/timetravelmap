import { Suspense } from "react";
import ClientMapPage from "../components/ClientMapPage";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <ClientMapPage />
    </Suspense>
  );
}
