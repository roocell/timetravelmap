"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Eye, EyeOff, Layers3, Map as MapIcon, Search } from "lucide-react";
import DatasetsCard from "./DatasetsCard";
import FeatureDetailsModal from "./FeatureDetailsModal";
import TimelineSlider from "./TimelineSlider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

const MAP_VIEW_STATE_KEY = "ttm.map-view-state";
const DEFAULT_LAT = 45.39793819727917;
const DEFAULT_LNG = -75.72070285499208;
const DEFAULT_ZOOM = 12;
const MIN_NATIVE_ZOOM = 12;
const MAX_NATIVE_ZOOM = 12;

const layerUrls = [
  "/tiles/1879/{z}/{x}/{y}.png",
  "/tiles/1928/{z}/{x}/{y}.png",
  "/tiles/1930s/{z}/{x}/{y}.png",
  "/tiles/1945/{z}/{x}/{y}.png",
  "/tiles/1954/{z}/{x}/{y}.png",
  "/tiles/1958/{z}/{x}/{y}.png",
  "/tiles/1965/{z}/{x}/{y}.png",
  "/tiles/2015_lidar/{z}/{x}/{y}.png",
  "/tiles/hrdem/{z}/{x}/{y}.png",
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
];

const sliderValues = [
  "New",
  "hrdem",
  "lidar",
  1965,
  1958,
  1954,
  1945,
  "1930s",
  1928,
  1879
];

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

function getNumericParam(searchParams, name, fallback) {
  const value = searchParams.get(name);

  if (value === null) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createTileLayer(url, opacity) {
  const isRemoteImagery = url.includes("arcgisonline");

  return L.tileLayer(url, {
    minNativeZoom: isRemoteImagery ? 12 : MIN_NATIVE_ZOOM,
    maxNativeZoom: isRemoteImagery ? 17 : MAX_NATIVE_ZOOM,
    minZoom: 5,
    maxZoom: 22,
    opacity,
    attribution: isRemoteImagery ? "Esri World Imagery" : "Historical tiles",
    tms: false
  });
}

function normalizeLeafletColor(value, fallback) {
  const color = String(value ?? "").trim();

  if (/^#[0-9a-f]{8}$/i.test(color)) {
    return color.slice(0, 7);
  }

  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  return fallback;
}

function loadSavedMapView() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(MAP_VIEW_STATE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (
      !Number.isFinite(parsed?.lat) ||
      !Number.isFinite(parsed?.lng) ||
      !Number.isFinite(parsed?.zoom) ||
      !Number.isFinite(parsed?.sliderValue)
    ) {
      return null;
    }

    return {
      lat: parsed.lat,
      lng: parsed.lng,
      zoom: parsed.zoom,
      sliderValue: parsed.sliderValue
    };
  } catch {
    return null;
  }
}

export default function TimeTravelMap({
  datasets,
  activeYears = [],
  prospectsActive = false,
  onToggleYear = () => {},
  onToggleProspects = () => {}
}) {
  const mapElementRef = useRef(null);
  const layerRefs = useRef([]);
  const datasetLayerRefs = useRef(new Map());
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const currentLocationMarkerRef = useRef(null);
  const currentLayerIndexRef = useRef(1);
  const sliderValueRef = useRef(1);
  const geolocationIntervalRef = useRef(null);
  const [zoomLabel, setZoomLabel] = useState(`Zoom: ${MIN_NATIVE_ZOOM}`);
  const [layersVisible, setLayersVisible] = useState(true);
  const [sliderValue, setSliderValue] = useState(1);
  const [selectedFeature, setSelectedFeature] = useState(null);

  const persistMapView = () => {
    if (typeof window === "undefined") {
      return;
    }

    const map = mapRef.current;
    if (!map) {
      return;
    }

    const center = map.getCenter();
    window.localStorage.setItem(
      MAP_VIEW_STATE_KEY,
      JSON.stringify({
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom(),
        sliderValue: sliderValueRef.current
      })
    );
  };

  const ensureLayer = (layerIndex) => {
    const map = mapRef.current;

    if (!map || layerIndex < 0 || layerIndex >= layerUrls.length) {
      return null;
    }

    if (!layerRefs.current[layerIndex]) {
      const layer = createTileLayer(layerUrls[layerIndex], 0);
      layer.on("tileerror", () => {});
      layer.addTo(map);
      layerRefs.current[layerIndex] = layer;
    }

    return layerRefs.current[layerIndex];
  };

  const setActiveLayerOpacities = (value, visible) => {
    const layer1Index = Math.floor(value);
    const layer2Index = layer1Index + 1;
    const layer2Opacity = value % 1;
    const layer1Opacity = 1 - layer2Opacity;

    ensureLayer(layer1Index);
    ensureLayer(layer2Index);

    layerRefs.current.forEach((layer, index) => {
      if (!layer) {
        return;
      }

      if (!visible) {
        layer.setOpacity(0);
        return;
      }

      if (index === layer1Index) {
        layer.setOpacity(layer1Opacity);
        return;
      }

      if (index === layer2Index && layer2Index < layerUrls.length) {
        layer.setOpacity(layer2Opacity);
        return;
      }

      layer.setOpacity(0);
    });

    currentLayerIndexRef.current = layer1Index;
  };

  const handleSliderChange = (value) => {
    sliderValueRef.current = value;
    setSliderValue(value);
    setActiveLayerOpacities(value, layersVisible);
    persistMapView();
  };

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    let isMapActive = true;

    const searchParams = new URLSearchParams(window.location.search);
    const savedView = loadSavedMapView();
    const lat = searchParams.has("lat")
      ? getNumericParam(searchParams, "lat", DEFAULT_LAT)
      : savedView?.lat ?? DEFAULT_LAT;
    const lng = searchParams.has("lng")
      ? getNumericParam(searchParams, "lng", DEFAULT_LNG)
      : savedView?.lng ?? DEFAULT_LNG;
    const zoom = searchParams.has("z")
      ? getNumericParam(searchParams, "z", DEFAULT_ZOOM)
      : savedView?.zoom ?? DEFAULT_ZOOM;
    const requestedLayerIndex = searchParams.has("l")
      ? getNumericParam(searchParams, "l", 1)
      : savedView?.sliderValue ?? 1;
    const initialLayerIndex = Math.min(
      Math.max(requestedLayerIndex, 0),
      layerUrls.length - 1
    );

    currentLayerIndexRef.current = initialLayerIndex;
    sliderValueRef.current = initialLayerIndex;
    setSliderValue(initialLayerIndex);

    const map = L.map(mapElementRef.current, {
      zoomControl: true
    }).setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);

    mapRef.current = map;

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 22
    }).addTo(map);

    map.setView([lat, lng], Number.isFinite(zoom) ? zoom : DEFAULT_ZOOM);

    if (lat !== DEFAULT_LAT || lng !== DEFAULT_LNG) {
      markerRef.current = L.marker([lat, lng]).addTo(map);
    }

    const showCurrentLocation = () => {
      if (!navigator.geolocation || !isMapActive || !mapRef.current) {
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isMapActive || !mapRef.current || !mapRef.current.getPanes()?.overlayPane) {
            return;
          }

          const point = [position.coords.latitude, position.coords.longitude];

          if (currentLocationMarkerRef.current) {
            currentLocationMarkerRef.current.setLatLng(point);
          } else {
            currentLocationMarkerRef.current = L.circleMarker(point, {
              color: "blue",
              fillColor: "blue",
              fillOpacity: 0.6,
              radius: 8
            }).addTo(map);
          }
        },
        () => {}
      );
    };

    const handleMapClick = (event) => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      const { lat: clickLat, lng: clickLng } = event.latlng;
      markerRef.current = L.marker([clickLat, clickLng]).addTo(map);

      const shareZoom = Math.min(map.getZoom(), MAX_NATIVE_ZOOM);
      const shareUrl = `${window.location.origin}/?lat=${clickLat}&lng=${clickLng}&z=${shareZoom}&l=${currentLayerIndexRef.current}`;
      const popupHtml = [
        `${clickLat},<br>${clickLng}`,
        `<a href="${shareUrl}">TTM Link</a>`,
        `<a href="https://www.google.com/maps/place/${clickLat},${clickLng}" target="_blank" rel="noreferrer">Google Maps Link</a>`
      ].join("<br>");

      markerRef.current.bindPopup(popupHtml).openPopup();
    };

    map.on("click", handleMapClick);
    map.on("zoom", () => {
      setZoomLabel(`Zoom: ${map.getZoom()}`);
    });
    map.on("moveend", persistMapView);
    map.on("zoomend", persistMapView);
    map.on("error", () => {});

    ensureLayer(initialLayerIndex);
    setActiveLayerOpacities(initialLayerIndex, true);
    setZoomLabel(`Zoom: ${map.getZoom()}`);
    persistMapView();
    showCurrentLocation();
    geolocationIntervalRef.current = window.setInterval(showCurrentLocation, 5000);

    const handleKeyDown = (event) => {
      if (event.code !== "Space") {
        return;
      }

      event.preventDefault();
      setLayersVisible((current) => {
        const next = !current;
        setActiveLayerOpacities(sliderValueRef.current, next);
        return next;
      });
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      isMapActive = false;
      document.removeEventListener("keydown", handleKeyDown);

      if (geolocationIntervalRef.current) {
        window.clearInterval(geolocationIntervalRef.current);
      }

      currentLocationMarkerRef.current = null;
      markerRef.current = null;
      map.off("click", handleMapClick);
      map.off("moveend", persistMapView);
      map.off("zoomend", persistMapView);
      datasetLayerRefs.current.forEach((layer) => {
        map.removeLayer(layer);
      });
      datasetLayerRefs.current.clear();
      map.remove();
      mapRef.current = null;
      layerRefs.current = [];
    };
  }, []);

  const toggleLayers = () => {
    const nextVisible = !layersVisible;
    setLayersVisible(nextVisible);
    setActiveLayerOpacities(sliderValueRef.current, nextVisible);
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    let cancelled = false;

    const syncDatasetLayers = async () => {
      const desiredKeys = new Set([
        ...activeYears.map((year) => `year:${year}`),
        ...(prospectsActive ? ["prospects"] : [])
      ]);

      for (const [key, layer] of datasetLayerRefs.current.entries()) {
        if (!desiredKeys.has(key)) {
          map.removeLayer(layer);
          datasetLayerRefs.current.delete(key);
        }
      }

      for (const year of activeYears) {
        if (cancelled || mapRef.current !== map || !map.getContainer()) {
          return;
        }

        const key = `year:${year}`;
        if (datasetLayerRefs.current.has(key)) {
          continue;
        }

        const response = await fetch(`/api/datasets/features?year=${year}`);
        if (cancelled || mapRef.current !== map || !map.getContainer() || !response.ok) {
          continue;
        }

        const payload = await response.json();
        if (cancelled || mapRef.current !== map || !map.getContainer()) {
          return;
        }

        const layerGroup = L.layerGroup();

        for (const event of payload.events ?? []) {
          const geoJsonLayer = L.geoJSON(event.geometry, {
            style: {
              color: normalizeLeafletColor(event.outlineColor, "#0f5e7d"),
              weight: event.outlineWidth ?? 3,
              fill: true,
              fillColor: normalizeLeafletColor(event.fillColor, "#8cc9de"),
              fillOpacity: 0.5
            }
          });

          geoJsonLayer.on("click", () => {
            setSelectedFeature({
              kind: "event",
              title: event.title,
              eventDate: event.eventDate,
              durationMinutes: event.durationMinutes,
              deviceUsed: event.deviceUsed,
              deviceMode: event.deviceMode,
              description: event.description,
              images: event.images ?? []
            });
          });
          geoJsonLayer.addTo(layerGroup);
        }

        for (const find of payload.finds ?? []) {
          const marker = L.circleMarker([find.latitude, find.longitude], {
            radius: 7,
            color: "#8f2d56",
            fillColor: "#d94c86",
            fillOpacity: 0.9,
            weight: 2
          });

          marker.on("click", () => {
            setSelectedFeature({
              kind: "find",
              title: find.title,
              findDate: find.findDate,
              ageLabel: find.ageLabel,
              type: find.type,
              metal: find.metal,
              itemCount: find.itemCount,
              description: find.description,
              images: find.images ?? []
            });
          });
          marker.addTo(layerGroup);
        }

        if (cancelled || mapRef.current !== map || !map.getContainer()) {
          return;
        }

        layerGroup.addTo(map);
        datasetLayerRefs.current.set(key, layerGroup);
      }

      if (prospectsActive && !datasetLayerRefs.current.has("prospects")) {
        const response = await fetch("/api/datasets/features?dataset=prospects");
        if (cancelled || mapRef.current !== map || !map.getContainer() || !response.ok) {
          return;
        }

        const payload = await response.json();
        if (cancelled || mapRef.current !== map || !map.getContainer()) {
          return;
        }

        const layerGroup = L.layerGroup();

        for (const prospect of payload.prospects ?? []) {
          const marker = L.circleMarker([prospect.latitude, prospect.longitude], {
            radius: 8,
            color: "#1f6f43",
            fillColor: "#39a96b",
            fillOpacity: 0.92,
            weight: 2
          });

          marker.on("click", () => {
            setSelectedFeature({
              kind: "prospect",
              title: prospect.title,
              ageLabel: prospect.ageLabel,
              dateVisited: prospect.dateVisited,
              description: prospect.description,
              images: prospect.images ?? []
            });
          });
          marker.addTo(layerGroup);
        }

        if (cancelled || mapRef.current !== map || !map.getContainer()) {
          return;
        }

        layerGroup.addTo(map);
        datasetLayerRefs.current.set("prospects", layerGroup);
      }
    };

    syncDatasetLayers();

    return () => {
      cancelled = true;
    };
  }, [activeYears, prospectsActive]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_45%),linear-gradient(180deg,#dce8ef_0%,#c3d2db_100%)] p-8 max-[700px]:p-4">
      <section className="mx-auto mb-5 flex max-w-[1400px] items-end justify-between gap-6 max-[700px]:mb-4 max-[700px]:flex-col max-[700px]:items-start">
        <div>
          <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.16em] text-[#6a7d88]">
            Ottawa Layers
          </p>
          <div className="flex items-center gap-3.5">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-[#eaf1f5] to-[#d6e2e8] text-[#15313f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <MapIcon size={24} strokeWidth={2.1} />
            </span>
            <h1 className="m-0 text-[clamp(28px,4vw,44px)] leading-[0.95] text-[#15313f]">
              Time Travel Map
            </h1>
          </div>
        </div>
        <p className="m-0 max-w-[460px] text-[14px] leading-[1.5] text-[#526773]">
          Crossfade historical imagery, then switch into imported field data
          sets from the KML archive below.
        </p>
      </section>

      <Card className="mx-auto max-w-[1400px]">
        <div className="m-0 flex items-center justify-between gap-4 border-b border-[rgba(21,49,63,0.08)] bg-gradient-to-b from-[rgba(240,246,249,0.96)] to-[rgba(232,239,243,0.96)] px-4 py-[14px] max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:p-3">
          <div className="flex min-w-0 items-center gap-3 max-[700px]:justify-between">
            <div className="inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#5a6d78]">
              <Layers3 size={15} strokeWidth={2.2} />
              <span>Map Controls</span>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-3 max-[700px]:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="inline-flex items-center gap-2"
            >
              <Search size={15} strokeWidth={2.2} />
              <span>{zoomLabel}</span>
            </Button>

            <Button
              type="button"
              onClick={toggleLayers}
              className="inline-flex items-center gap-2"
            >
              {layersVisible ? (
                <Eye size={15} strokeWidth={2.2} />
              ) : (
                <EyeOff size={15} strokeWidth={2.2} />
              )}
              <span>{layersVisible ? "Hide Layers" : "Show Layers"}</span>
            </Button>
          </div>
        </div>

        <div className="relative m-0 h-[min(72vh,900px)] overflow-hidden bg-[#d9e3ea] max-[700px]:h-[68vh]">
          <div ref={mapElementRef} className="h-full w-full" />
        </div>

        <TimelineSlider
          labels={sliderValues}
          max={layerUrls.length - 1}
          value={sliderValue}
          onChange={handleSliderChange}
          reversed
        />
      </Card>

      <DatasetsCard
        years={datasets?.years ?? []}
        prospectCount={datasets?.prospects?.count ?? 0}
        loading={datasets?.loading}
        activeYears={activeYears}
        prospectsActive={prospectsActive}
        onToggleYear={onToggleYear}
        onToggleProspects={onToggleProspects}
      />

      <FeatureDetailsModal feature={selectedFeature} onClose={() => setSelectedFeature(null)} />
    </main>
  );
}
