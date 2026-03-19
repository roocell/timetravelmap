"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Eye, EyeOff, Layers3, Map as MapIcon, Search } from "lucide-react";
import styles from "./TimeTravelMap.module.css";
import TimelineSlider from "./TimelineSlider";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

const DEFAULT_LAT = 45.39793819727917;
const DEFAULT_LNG = -75.72070285499208;
const DEFAULT_ZOOM = 12;
const MIN_NATIVE_ZOOM = 12;
const MAX_NATIVE_ZOOM = 12;

const layerUrls = [
  "/1879/{z}/{x}/{y}.png",
  "/1928/{z}/{x}/{y}.png",
  "/1930s/{z}/{x}/{y}.png",
  "/1945/{z}/{x}/{y}.png",
  "/1954/{z}/{x}/{y}.png",
  "/1958/{z}/{x}/{y}.png",
  "/1965/{z}/{x}/{y}.png",
  "/2015_lidar/{z}/{x}/{y}.png",
  "/hrdem/{z}/{x}/{y}.png",
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

export default function TimeTravelMap() {
  const mapElementRef = useRef(null);
  const layerRefs = useRef([]);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const currentLocationMarkerRef = useRef(null);
  const currentLayerIndexRef = useRef(1);
  const sliderValueRef = useRef(1);
  const geolocationIntervalRef = useRef(null);
  const [zoomLabel, setZoomLabel] = useState(`Zoom: ${MIN_NATIVE_ZOOM}`);
  const [layersVisible, setLayersVisible] = useState(true);
  const [sliderValue, setSliderValue] = useState(1);

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
  };

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    let isMapActive = true;

    const searchParams = new URLSearchParams(window.location.search);
    const lat = getNumericParam(searchParams, "lat", DEFAULT_LAT);
    const lng = getNumericParam(searchParams, "lng", DEFAULT_LNG);
    const zoom = getNumericParam(searchParams, "z", DEFAULT_ZOOM);
    const requestedLayerIndex = getNumericParam(searchParams, "l", 1);
    const initialLayerIndex = Math.min(
      Math.max(Math.floor(requestedLayerIndex), 0),
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
    map.on("error", () => {});

    ensureLayer(initialLayerIndex);
    setActiveLayerOpacities(initialLayerIndex, true);
    setZoomLabel(`Zoom: ${map.getZoom()}`);
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

  return (
    <main className={styles.page}>
      <section className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Ottawa Layers</p>
          <div className={styles.titleGroup}>
            <span className={styles.titleIconWrap}>
              <MapIcon size={24} strokeWidth={2.1} />
            </span>
            <h1 className={styles.title}>Time Travel Map</h1>
          </div>
        </div>
        <p className={styles.subtitle}>
          Crossfade between historical imagery, lidar, and modern satellite
          tiles while keeping the Leaflet map interactions intact.
        </p>
      </section>

      <Card className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <div className={styles.toolbarLabel}>
              <Layers3 size={15} strokeWidth={2.2} />
              <span>Map Controls</span>
            </div>
          </div>

          <div className={styles.toolbarGroup}>
            <Button type="button" variant="ghost" className={styles.panelContent}>
              <Search size={15} strokeWidth={2.2} />
              <span>{zoomLabel}</span>
            </Button>

            <Button type="button" onClick={toggleLayers} className={styles.panelContent}>
              {layersVisible ? (
                <Eye size={15} strokeWidth={2.2} />
              ) : (
                <EyeOff size={15} strokeWidth={2.2} />
              )}
              <span>{layersVisible ? "Hide Layers" : "Show Layers"}</span>
            </Button>
          </div>
        </div>

        <div className={styles.mapCardBody}>
          <div ref={mapElementRef} className={styles.map} />
        </div>

        <TimelineSlider
          labels={sliderValues}
          max={layerUrls.length - 1}
          value={sliderValue}
          onChange={handleSliderChange}
          reversed
        />
      </Card>
    </main>
  );
}
