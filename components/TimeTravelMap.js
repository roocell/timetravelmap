"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  Check,
  Coins,
  Crosshair,
  Eye,
  EyeOff,
  Layers3,
  LogIn,
  Map as MapIcon,
  MapPinned,
  PencilRuler,
  Search,
  Undo2,
  X
} from "lucide-react";
import { UserButton, useStackApp, useUser } from "@stackframe/stack";
import { BrandIcons } from "@stackframe/stack-ui";
import CreateFeatureModal from "./CreateFeatureModal";
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

const layerDefinitions = [
  { key: "1879", url: "/tiles/1879/{z}/{x}/{y}.png" },
  { key: "1928", url: "/tiles/1928/{z}/{x}/{y}.png" },
  { key: "1930s", url: "/tiles/1930s/{z}/{x}/{y}.png" },
  { key: "1945", url: "/tiles/1945/{z}/{x}/{y}.png" },
  { key: "1954", url: "/tiles/1954/{z}/{x}/{y}.png" },
  { key: "1958", url: "/tiles/1958/{z}/{x}/{y}.png" },
  { key: "1965", url: "/tiles/1965/{z}/{x}/{y}.png" },
  { key: "2015_lidar", url: "/tiles/2015_lidar/{z}/{x}/{y}.png" },
  { key: "hrdem", url: "/tiles/hrdem/{z}/{x}/{y}.png" },
  {
    key: null,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  }
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

function createTileLayer(layerDefinition, opacity, tileLayerMeta) {
  const url = layerDefinition?.url;
  if (typeof url !== "string" || url.length === 0) {
    return null;
  }

  const isRemoteImagery = url.includes("arcgisonline");
  const localMeta = layerDefinition?.key ? tileLayerMeta?.[layerDefinition.key] : null;
  const minNativeZoom = isRemoteImagery ? 12 : localMeta?.minNativeZoom ?? MIN_NATIVE_ZOOM;
  const maxNativeZoom = isRemoteImagery ? 17 : localMeta?.maxNativeZoom ?? MAX_NATIVE_ZOOM;

  return L.tileLayer(url, {
    minNativeZoom,
    maxNativeZoom,
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

function darkenHexColor(value, amount = 0.32) {
  const color = normalizeLeafletColor(value, "#f0c419").slice(1);
  const channels = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(color.slice(index, index + 2), 16);
    const darkened = Math.round(channel * (1 - amount));
    return Math.max(0, Math.min(255, darkened))
      .toString(16)
      .padStart(2, "0");
  });

  return `#${channels.join("")}`;
}

function getProspectMarkerStyle(prospect) {
  const fillColor = normalizeLeafletColor(prospect?.markerColor, "#f0c419");
  return {
    radius: 12,
    color: darkenHexColor(fillColor),
    fillColor,
    fillOpacity: 0.92,
    weight: 2
  };
}

function getFindShortLabel(find) {
  const type = String(find?.type ?? "").toLowerCase();
  const metal = String(find?.metal ?? "").toUpperCase();
  const title = String(find?.title ?? "").toLowerCase();
  const description = String(find?.description ?? "").toLowerCase();

  if (type === "ring" || title.includes("ring") || description.includes("ring")) {
    return "R";
  }

  if (metal === "C") {
    return "C";
  }

  if (metal === "S" || title.includes("silver") || description.includes("silver")) {
    return "S";
  }

  if (metal === "G" || title.includes("gold") || description.includes("gold")) {
    return "G";
  }

  return null;
}

function buildApiErrorMessage(body, fallback) {
  const base = body?.error ?? fallback;
  if (!body?.debug || typeof body.debug !== "object") {
    return base;
  }

  const debugEntries = Object.entries(body.debug)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([key, value]) => `${key}=${value}`);

  return debugEntries.length > 0 ? `${base} (${debugEntries.join(", ")})` : base;
}

function getYearFromDateLike(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function bindFeatureHoverPreview(layer, feature) {
  const primaryImage = Array.isArray(feature?.images) ? feature.images[0] : null;
  const title = escapeHtml(feature?.title ?? "");
  const caption = escapeHtml(primaryImage?.caption ?? "");

  const previewHtml = primaryImage?.src
    ? `
      <div style="width:200px;overflow:hidden;border-radius:16px;background:#ffffff;box-shadow:0 14px 36px rgba(7,18,24,0.18);">
        <img src="${escapeHtml(primaryImage.src)}" alt="${title}" style="display:block;height:132px;width:100%;object-fit:cover;" />
        <div style="padding:10px 12px;">
          <div style="font-size:13px;font-weight:800;line-height:1.3;color:#15313f;">${title}</div>
          ${caption ? `<div style="margin-top:4px;font-size:11px;line-height:1.4;color:#526773;">${caption}</div>` : ""}
        </div>
      </div>
    `
    : `<div style="border-radius:14px;background:#ffffff;padding:10px 12px;font-size:13px;font-weight:800;color:#15313f;box-shadow:0 14px 36px rgba(7,18,24,0.18);">${title}</div>`;

  layer.bindTooltip(previewHtml, {
    direction: "top",
    offset: [0, -12],
    opacity: 1,
    sticky: true,
    className: "ttm-feature-hover-card"
  });
}

function createFindMarker(find) {
  const shortLabel = getFindShortLabel(find);

  if (!shortLabel) {
    return L.circleMarker([find.latitude, find.longitude], {
      radius: 7,
      color: "#1f6f43",
      fillColor: "#39a96b",
      fillOpacity: 0.9,
      weight: 2
    });
  }

  const icon = L.divIcon({
    className: "",
    html: `<div style="display:flex;height:24px;width:24px;align-items:center;justify-content:center;border-radius:9999px;border:2px solid #1f6f43;background:#39a96b;color:#fff;font-size:12px;font-weight:800;line-height:1;box-shadow:0 4px 12px rgba(31,111,67,0.28);">${shortLabel}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  return L.marker([find.latitude, find.longitude], { icon });
}

function createDraftVertexMarker(map, point, index, isLastPoint, onPreviewMove, onCommitMove) {
  const icon = L.divIcon({
    className: "",
    html: `<div style="display:flex;height:16px;width:16px;align-items:center;justify-content:center;border-radius:9999px;border:2px solid #15313f;background:${isLastPoint ? "#f0c419" : "#ffffff"};box-shadow:0 4px 10px rgba(21,49,63,0.18);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const marker = L.marker([point.lat, point.lng], {
    draggable: true,
    icon,
    zIndexOffset: 1000
  });

  marker.on("dragstart", () => {
    map.dragging?.disable();
  });

  marker.on("drag", (event) => {
    const latLng = event.target.getLatLng();
    onPreviewMove(index, latLng);
  });

  marker.on("dragend", (event) => {
    const latLng = event.target.getLatLng();
    onCommitMove(index, latLng);
    map.dragging?.enable();
  });

  marker.on("click", (event) => {
    L.DomEvent.stopPropagation(event);
  });

  marker.on("mousedown", (event) => {
    L.DomEvent.stopPropagation(event);
  });

  marker.on("touchstart", (event) => {
    L.DomEvent.stopPropagation(event);
  });

  return marker;
}

function createDraftPointMarker(map, point, kind, onPreviewMove, onCommitMove) {
  const colors =
    kind === "prospect"
      ? {
          border: "#9a7a07",
          fill: "#f0c419"
        }
      : {
          border: "#1f6f43",
          fill: "#39a96b"
        };

  const icon = L.divIcon({
    className: "",
    html: `<div style="display:flex;height:20px;width:20px;align-items:center;justify-content:center;border-radius:9999px;border:3px solid ${colors.border};background:${colors.fill};box-shadow:0 4px 12px rgba(21,49,63,0.22);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const marker = L.marker([point.lat, point.lng], {
    draggable: true,
    icon,
    zIndexOffset: 1000
  });

  marker.on("dragstart", () => {
    map.dragging?.disable();
  });

  marker.on("drag", (event) => {
    onPreviewMove(event.target.getLatLng());
  });

  marker.on("dragend", (event) => {
    onCommitMove(event.target.getLatLng());
    map.dragging?.enable();
  });

  marker.on("click", (event) => {
    L.DomEvent.stopPropagation(event);
  });

  marker.on("mousedown", (event) => {
    L.DomEvent.stopPropagation(event);
  });

  marker.on("touchstart", (event) => {
    L.DomEvent.stopPropagation(event);
  });

  return marker;
}

function createEventFeatureLayer(event, openFeature) {
  const geoJsonLayer = L.geoJSON(event.geometry, {
    style: {
      color: normalizeLeafletColor(event.outlineColor, "#0f5e7d"),
      weight: event.outlineWidth ?? 3,
      fill: true,
      fillColor: normalizeLeafletColor(event.fillColor, "#8cc9de"),
      fillOpacity: 0.5
    }
  });

  geoJsonLayer.eachLayer((layer) => {
    bindFeatureHoverPreview(layer, event);

    layer.on("click", (clickEvent) => {
      L.DomEvent.stopPropagation(clickEvent);
      openFeature({
        id: event.id,
        kind: "event",
        ownerId: event.ownerId,
        title: event.title,
        eventDate: event.eventDate,
        areaM2: event.areaM2,
        durationMinutes: event.durationMinutes,
        deviceUsed: event.deviceUsed,
        deviceMode: event.deviceMode,
        description: event.description,
        geometry: event.geometry,
        images: event.images ?? []
      });
    });
  });

  return geoJsonLayer;
}

function createFindFeatureLayer(find, openFeature) {
  const marker = createFindMarker(find);
  bindFeatureHoverPreview(marker, find);

  marker.on("click", (clickEvent) => {
    L.DomEvent.stopPropagation(clickEvent);
    openFeature({
      id: find.id,
      kind: "find",
      ownerId: find.ownerId,
      title: find.title,
      findDate: find.findDate,
      ageLabel: find.ageLabel,
      type: find.type,
      metal: find.metal,
      itemCount: find.itemCount,
      latitude: find.latitude,
      longitude: find.longitude,
      description: find.description,
      images: find.images ?? []
    });
  });

  return marker;
}

function getFeatureDatasetKey(feature) {
  if (!feature) {
    return null;
  }

  if (feature.kind === "prospect") {
    return "prospects";
  }

  const dateValue = feature.kind === "event" ? feature.eventDate : feature.findDate;
  const year = Number.parseInt(String(dateValue ?? "").slice(0, 4), 10);
  return Number.isFinite(year) ? `year:${year}` : null;
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
  datasetDebug = null,
  activeYears = [],
  prospectsActive = false,
  onDatasetsChanged = () => {},
  onToggleYear = () => {},
  onToggleProspects = () => {}
}) {
  const user = useUser({ includeRestricted: true });
  const stackApp = useStackApp();
  const currentUserId = user?.id ?? null;
  const timelineLocked = !user || user.isRestricted === true;
  const mapElementRef = useRef(null);
  const layerRefs = useRef([]);
  const datasetLayerRefs = useRef(new Map());
  const drawingLayerRef = useRef(null);
  const yearFeaturesCacheRef = useRef(new Map());
  const featureOverridesRef = useRef({});
  const creationModeRef = useRef(null);
  const modalOpenRef = useRef(false);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const currentLocationMarkerRef = useRef(null);
  const currentLayerIndexRef = useRef(1);
  const sliderValueRef = useRef(1);
  const geolocationIntervalRef = useRef(null);
  const [zoomLabel, setZoomLabel] = useState(MIN_NATIVE_ZOOM);
  const [layersVisible, setLayersVisible] = useState(true);
  const [sliderValue, setSliderValue] = useState(1);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [featureOverrides, setFeatureOverrides] = useState({});
  const [datasetRefreshToken, setDatasetRefreshToken] = useState(0);
  const [creationMode, setCreationMode] = useState(null);
  const [draftPoints, setDraftPoints] = useState([]);
  const [showCreateFeatureModal, setShowCreateFeatureModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [editingFeature, setEditingFeature] = useState(null);
  const [tileLayerMeta, setTileLayerMeta] = useState({});
  const previousEditingDatasetKeyRef = useRef(null);

  useEffect(() => {
    featureOverridesRef.current = featureOverrides;
  }, [featureOverrides]);

  useEffect(() => {
    creationModeRef.current = creationMode;
  }, [creationMode]);

  useEffect(() => {
    modalOpenRef.current = Boolean(selectedFeature || showCreateFeatureModal || showAuthModal);
  }, [selectedFeature, showCreateFeatureModal, showAuthModal]);

  useEffect(() => {
    if (currentUserId) {
      setShowAuthModal(false);
      setAuthPending(false);
      setAuthError("");
    }
  }, [currentUserId]);

  useEffect(() => {
    const state = { cancelled: false };

    const loadTileLayerMeta = async () => {
      try {
        const response = await fetch("/api/tiles/meta", {
          cache: "no-store"
        });
        const payload = await response.json().catch(() => ({}));

        if (!state.cancelled && response.ok && payload && typeof payload === "object") {
          setTileLayerMeta(payload);
        }
      } catch {}
    };

    void loadTileLayerMeta();

    return () => {
      state.cancelled = true;
    };
  }, []);

  const beginGoogleSignIn = async () => {
    setAuthPending(true);
    setAuthError("");

    try {
      await stackApp.signInWithOAuth("google");
    } catch (error) {
      setAuthPending(false);
      setAuthError(error instanceof Error ? error.message : "Unable to start Google sign in.");
    }
  };

  const openFeature = (feature) => {
    const overrideKey = `${feature.kind}:${feature.id}`;
    setSelectedFeature(featureOverridesRef.current[overrideKey] ?? feature);
  };

  const zoomToCurrentLocation = () => {
    const map = mapRef.current;
    if (!map || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
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

        map.setView(point, Math.max(map.getZoom(), 16));
      },
      () => {}
    );
  };

  const clearDraft = () => {
    setDraftPoints([]);
    setShowCreateFeatureModal(false);
    setCreationMode(null);
    setEditingFeature(null);
  };

  const startEventDraw = () => {
    setSelectedFeature(null);
    setShowCreateFeatureModal(false);
    setDraftPoints([]);
    setCreationMode("event");
  };

  const startFindDraw = () => {
    setSelectedFeature(null);
    setShowCreateFeatureModal(false);
    setDraftPoints([]);
    setCreationMode("find");
  };

  const startProspectDraw = () => {
    setSelectedFeature(null);
    setShowCreateFeatureModal(false);
    setDraftPoints([]);
    setCreationMode("prospect");
  };

  const beginFeatureMove = (feature) => {
    if (feature.kind === "event") {
      const geometry = feature.geometry;
      const ring =
        geometry?.type === "MultiPolygon"
          ? geometry.coordinates?.[0]?.[0]
          : geometry?.type === "Polygon"
            ? geometry.coordinates?.[0]
            : null;
      if (!Array.isArray(ring)) {
        return;
      }

      const points = ring
        .map((coordinate) => {
          if (!Array.isArray(coordinate) || coordinate.length < 2) {
            return null;
          }

          return {
            lat: Number(coordinate[1]),
            lng: Number(coordinate[0])
          };
        })
        .filter(Boolean);

      if (points.length > 1) {
        const first = points[0];
        const last = points[points.length - 1];
        if (first && last && first.lat === last.lat && first.lng === last.lng) {
          points.pop();
        }
      }

      setDraftPoints(points);
      setEditingFeature(feature);
      setCreationMode("event");
      return;
    }

    if (feature.latitude != null && feature.longitude != null) {
      setDraftPoints([
        {
          lat: feature.latitude,
          lng: feature.longitude
        }
      ]);
      setEditingFeature(feature);
      setCreationMode(feature.kind);
    }
  };

  const undoDraftPoint = () => {
    setDraftPoints((current) => current.slice(0, -1));
  };

  const finishDraft = () => {
    if (editingFeature) {
      void saveEditedFeatureGeometry();
      return;
    }

    if (creationMode === "event" && draftPoints.length < 3) {
      return;
    }

    if ((creationMode === "find" || creationMode === "prospect") && draftPoints.length < 1) {
      return;
    }

    setShowCreateFeatureModal(true);
  };

  const scrollMapIntoView = () => {
    mapElementRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  };

  const fetchYearFeatures = async (year) => {
    if (yearFeaturesCacheRef.current.has(year)) {
      return yearFeaturesCacheRef.current.get(year);
    }

    const response = await fetch(`/api/datasets/features?year=${year}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    yearFeaturesCacheRef.current.set(year, payload);
    return payload;
  };

  const fetchProspectFeatures = async () => {
    if (yearFeaturesCacheRef.current.has("prospects")) {
      return yearFeaturesCacheRef.current.get("prospects");
    }

    const response = await fetch("/api/datasets/features?dataset=prospects", {
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    yearFeaturesCacheRef.current.set("prospects", payload);
    return payload;
  };

  const focusDatasetEntry = async (year, entry) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    scrollMapIntoView();

    if (!activeYears.includes(year)) {
      onToggleYear(year);
    }

    const payload = await fetchYearFeatures(year);
    if (!payload) {
      return;
    }

    if (entry.kind === "event") {
      const event = (payload.events ?? []).find((item) => item.id === entry.id);
      if (!event) {
        return;
      }

      const boundsLayer = L.geoJSON(event.geometry);
      const bounds = boundsLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 17
        });
      }

      openFeature({
        id: event.id,
        kind: "event",
        ownerId: event.ownerId,
        title: event.title,
        eventDate: event.eventDate,
        areaM2: event.areaM2,
        durationMinutes: event.durationMinutes,
        deviceUsed: event.deviceUsed,
        deviceMode: event.deviceMode,
        description: event.description,
        geometry: event.geometry,
        images: event.images ?? []
      });
      return;
    }

    const find = (payload.finds ?? []).find((item) => item.id === entry.id);
    if (!find) {
      return;
    }

    map.setView([find.latitude, find.longitude], Math.max(map.getZoom(), 17), {
      animate: true
    });
    openFeature({
      id: find.id,
      kind: "find",
      ownerId: find.ownerId,
      title: find.title,
      findDate: find.findDate,
      ageLabel: find.ageLabel,
      type: find.type,
      metal: find.metal,
      itemCount: find.itemCount,
      latitude: find.latitude,
      longitude: find.longitude,
      description: find.description,
      images: find.images ?? []
    });
  };

  const focusProspectEntry = async (prospectId) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    scrollMapIntoView();

    if (!prospectsActive) {
      onToggleProspects();
    }

    const payload = await fetchProspectFeatures();
    if (!payload) {
      return;
    }

    const prospect = (payload.prospects ?? []).find((item) => item.id === prospectId);
    if (!prospect) {
      return;
    }

    map.setView([prospect.latitude, prospect.longitude], Math.max(map.getZoom(), 17), {
      animate: true
    });
    openFeature({
      id: prospect.id,
      kind: "prospect",
      ownerId: prospect.ownerId,
      title: prospect.title,
      ageLabel: prospect.ageLabel,
      dateVisited: prospect.dateVisited,
      latitude: prospect.latitude,
      longitude: prospect.longitude,
      description: prospect.description,
      images: prospect.images ?? []
    });
  };

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

    if (!map || layerIndex < 0 || layerIndex >= layerDefinitions.length) {
      return null;
    }

    const layerDefinition = layerDefinitions[layerIndex];
    if (typeof layerDefinition?.url !== "string" || layerDefinition.url.length === 0) {
      return null;
    }

    if (!layerRefs.current[layerIndex]) {
      const layer = createTileLayer(layerDefinition, 0, tileLayerMeta);
      if (!layer) {
        return null;
      }
      layer.on("tileerror", () => {});
      layer.addTo(map);
      layerRefs.current[layerIndex] = layer;
    }

    return layerRefs.current[layerIndex];
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || Object.keys(tileLayerMeta).length === 0) {
      return;
    }

    layerRefs.current.forEach((layer, index) => {
      const layerDefinition = layerDefinitions[index];
      if (!layer || !layerDefinition?.key || !tileLayerMeta[layerDefinition.key]) {
        return;
      }

      const opacity = typeof layer.options?.opacity === "number" ? layer.options.opacity : 0;
      map.removeLayer(layer);

      const nextLayer = createTileLayer(layerDefinition, opacity, tileLayerMeta);
      if (!nextLayer) {
        layerRefs.current[index] = null;
        return;
      }

      nextLayer.on("tileerror", () => {});
      nextLayer.addTo(map);
      layerRefs.current[index] = nextLayer;
    });
  }, [tileLayerMeta]);

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

      if (index === layer2Index && layer2Index < layerDefinitions.length) {
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
      layerDefinitions.length - 1
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
      if (creationModeRef.current === "event") {
        setDraftPoints((current) => [
          ...current,
          {
            lat: event.latlng.lat,
            lng: event.latlng.lng
          }
        ]);
        return;
      }

      if (creationModeRef.current === "find" || creationModeRef.current === "prospect") {
        setDraftPoints([
          {
            lat: event.latlng.lat,
            lng: event.latlng.lng
          }
        ]);
        setShowCreateFeatureModal(true);
        return;
      }

      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      const { lat: clickLat, lng: clickLng } = event.latlng;
      markerRef.current = L.marker([clickLat, clickLng]).addTo(map);

      const shareZoom = Math.min(map.getZoom(), MAX_NATIVE_ZOOM);
      const popupHtml = [
        `${clickLat},<br>${clickLng}`,
        `<a href="https://www.google.com/maps/place/${clickLat},${clickLng}" target="_blank" rel="noreferrer">Google Maps Link</a>`
      ].join("<br>");

      markerRef.current.bindPopup(popupHtml).openPopup();
    };

    map.on("click", handleMapClick);
    map.on("zoom", () => {
      setZoomLabel(Math.round(map.getZoom()));
    });
    map.on("moveend", persistMapView);
    map.on("zoomend", persistMapView);
    map.on("error", () => {});

    ensureLayer(initialLayerIndex);
    setActiveLayerOpacities(initialLayerIndex, true);
    setZoomLabel(Math.round(map.getZoom()));
    persistMapView();
    showCurrentLocation();
    geolocationIntervalRef.current = window.setInterval(showCurrentLocation, 5000);

    const handleKeyDown = (event) => {
      if (event.code !== "Space") {
        return;
      }

      if (modalOpenRef.current) {
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
      drawingLayerRef.current = null;
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const nextKey = getFeatureDatasetKey(editingFeature);
    const previousKey = previousEditingDatasetKeyRef.current;

    if (previousKey && previousKey !== nextKey) {
      const previousLayer = datasetLayerRefs.current.get(previousKey);
      if (previousLayer) {
        map.removeLayer(previousLayer);
        datasetLayerRefs.current.delete(previousKey);
      }
    }

    if (nextKey) {
      const currentLayer = datasetLayerRefs.current.get(nextKey);
      if (currentLayer) {
        map.removeLayer(currentLayer);
        datasetLayerRefs.current.delete(nextKey);
      }
    }

    previousEditingDatasetKeyRef.current = nextKey;
  }, [editingFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!drawingLayerRef.current) {
      drawingLayerRef.current = L.layerGroup().addTo(map);
    }

    const layer = drawingLayerRef.current;
    layer.clearLayers();

    if (!draftPoints.length) {
      return;
    }

    const latLngs = draftPoints.map((point) => [point.lat, point.lng]);

    if (creationMode === "event") {
      const line = L.polyline(latLngs, {
        color: "#15313f",
        weight: 3,
        opacity: 0.85,
        dashArray: "6 6"
      });
      layer.addLayer(line);

      let polygon = null;
      if (draftPoints.length >= 3) {
        polygon = L.polygon(latLngs, {
          color: "#0f5e7d",
          weight: 3,
          fillColor: "#8cc9de",
          fillOpacity: 0.35
        });
        layer.addLayer(polygon);
      }

      draftPoints.forEach((point, index) => {
        createDraftVertexMarker(
          map,
          point,
          index,
          index === draftPoints.length - 1,
          (pointIndex, latLng) => {
            const nextLatLngs = latLngs.map((entry, entryIndex) =>
              entryIndex === pointIndex ? [latLng.lat, latLng.lng] : entry
            );
            line.setLatLngs(nextLatLngs);
            polygon?.setLatLngs(nextLatLngs);
          },
          (pointIndex, latLng) => {
            setDraftPoints((current) =>
              current.map((entry, entryIndex) =>
                entryIndex === pointIndex
                  ? {
                      lat: latLng.lat,
                      lng: latLng.lng
                    }
                  : entry
              )
            );
          }
        ).addTo(layer);
      });
    }

    if ((creationMode === "find" || creationMode === "prospect") && draftPoints[0]) {
      const point = draftPoints[0];
      createDraftPointMarker(
        map,
        point,
        creationMode,
        (latLng) => {
          const draftMarker = layer.getLayers().find((entry) => entry instanceof L.Marker);
          if (draftMarker instanceof L.Marker) {
            draftMarker.setLatLng(latLng);
          }
        },
        (latLng) => {
          setDraftPoints([
            {
              lat: latLng.lat,
              lng: latLng.lng
            }
          ]);
        }
      ).addTo(layer);
    }

  }, [creationMode, draftPoints]);

  const invalidateYear = (year) => {
    yearFeaturesCacheRef.current.delete(year);
    const existingLayer = datasetLayerRefs.current.get(`year:${year}`);
    if (existingLayer && mapRef.current) {
      mapRef.current.removeLayer(existingLayer);
      datasetLayerRefs.current.delete(`year:${year}`);
    }
  };

  const refreshYear = (year) => {
    invalidateYear(year);

    if (!activeYears.includes(year)) {
      onToggleYear(year);
    } else {
      setDatasetRefreshToken((current) => current + 1);
    }
  };

  const refreshActiveYearLayer = (year) => {
    if (!Number.isFinite(year)) {
      return;
    }

    invalidateYear(year);

    if (activeYears.includes(year)) {
      setDatasetRefreshToken((current) => current + 1);
    }
  };

  const refreshProspects = () => {
    yearFeaturesCacheRef.current.delete("prospects");
    const existingLayer = datasetLayerRefs.current.get("prospects");
    if (existingLayer && mapRef.current) {
      mapRef.current.removeLayer(existingLayer);
      datasetLayerRefs.current.delete("prospects");
    }

    if (prospectsActive) {
      setDatasetRefreshToken((current) => current + 1);
    }
  };

  const buildYearLayerGroup = (payload) => {
    const layerGroup = L.layerGroup();

    for (const event of (payload?.events ?? []).filter(
      (feature) => !(editingFeature?.kind === "event" && editingFeature.id === feature.id)
    )) {
      createEventFeatureLayer(event, openFeature).addTo(layerGroup);
    }

    for (const find of (payload?.finds ?? []).filter(
      (feature) => !(editingFeature?.kind === "find" && editingFeature.id === feature.id)
    )) {
      createFindFeatureLayer(find, openFeature).addTo(layerGroup);
    }

    return layerGroup;
  };

  const buildProspectLayerGroup = (payload) => {
    const layerGroup = L.layerGroup();

    for (const prospect of (payload?.prospects ?? []).filter(
      (feature) => !(editingFeature?.kind === "prospect" && editingFeature.id === feature.id)
    )) {
      const marker = L.circleMarker([prospect.latitude, prospect.longitude], {
        ...getProspectMarkerStyle(prospect)
      });
      bindFeatureHoverPreview(marker, prospect);

      marker.on("click", (clickEvent) => {
        L.DomEvent.stopPropagation(clickEvent);
        openFeature({
          id: prospect.id,
          kind: "prospect",
          ownerId: prospect.ownerId,
          title: prospect.title,
          ageLabel: prospect.ageLabel,
          dateVisited: prospect.dateVisited,
          markerColor: prospect.markerColor,
          latitude: prospect.latitude,
          longitude: prospect.longitude,
          description: prospect.description,
          images: prospect.images ?? []
        });
      });

      marker.addTo(layerGroup);
    }

    return layerGroup;
  };

  const reloadYearLayer = async (year) => {
    const map = mapRef.current;
    if (!map) {
      return null;
    }

    invalidateYear(year);
    const payload = await fetchYearFeatures(year);
    if (!payload || mapRef.current !== map || !map.getContainer()) {
      return payload;
    }

    const layerGroup = buildYearLayerGroup(payload);
    layerGroup.addTo(map);
    datasetLayerRefs.current.set(`year:${year}`, layerGroup);
    return payload;
  };

  const reloadProspectLayer = async () => {
    const map = mapRef.current;
    if (!map) {
      return null;
    }

    yearFeaturesCacheRef.current.delete("prospects");
    const existingLayer = datasetLayerRefs.current.get("prospects");
    if (existingLayer) {
      map.removeLayer(existingLayer);
      datasetLayerRefs.current.delete("prospects");
    }

    const payload = await fetchProspectFeatures();
    if (!payload || mapRef.current !== map || !map.getContainer()) {
      return payload;
    }

    const layerGroup = buildProspectLayerGroup(payload);
    layerGroup.addTo(map);
    datasetLayerRefs.current.set("prospects", layerGroup);
    return payload;
  };

  const appendProspectToActiveLayer = (prospect) => {
    const layerGroup = datasetLayerRefs.current.get("prospects");
    if (!layerGroup) {
      return false;
    }

    const marker = L.circleMarker([prospect.latitude, prospect.longitude], {
      ...getProspectMarkerStyle(prospect)
    });
    bindFeatureHoverPreview(marker, prospect);

    marker.on("click", (clickEvent) => {
      L.DomEvent.stopPropagation(clickEvent);
      openFeature({
        id: prospect.id,
        kind: "prospect",
        ownerId: prospect.ownerId,
        title: prospect.title,
        ageLabel: prospect.ageLabel,
        dateVisited: prospect.dateVisited,
        markerColor: prospect.markerColor,
        latitude: prospect.latitude,
        longitude: prospect.longitude,
        description: prospect.description,
        images: prospect.images ?? []
      });
    });

    marker.addTo(layerGroup);
    return true;
  };

  const appendFeatureToActiveYear = (year, feature) => {
    const layerGroup = datasetLayerRefs.current.get(`year:${year}`);
    if (!layerGroup) {
      return false;
    }

    if (feature.kind === "event") {
      createEventFeatureLayer(feature, openFeature).addTo(layerGroup);
      return true;
    }

    createFindFeatureLayer(feature, openFeature).addTo(layerGroup);
    return true;
  };

  const mergeFeatureIntoYearCache = (year, feature) => {
    const cached = yearFeaturesCacheRef.current.get(year);
    if (!cached) {
      return;
    }

    const nextEvents =
      feature.kind === "event"
        ? [...(cached.events ?? []).filter((entry) => entry.id !== feature.id), feature]
        : cached.events ?? [];
    const nextFinds =
      feature.kind === "find"
        ? [...(cached.finds ?? []).filter((entry) => entry.id !== feature.id), feature]
        : cached.finds ?? [];

    yearFeaturesCacheRef.current.set(year, {
      ...cached,
      events: nextEvents,
      finds: nextFinds
    });
  };

  const saveEditedFeatureGeometry = async () => {
    if (!editingFeature) {
      return;
    }

    const payload =
      editingFeature.kind === "event"
        ? { points: draftPoints }
        : {
            latitude: draftPoints[0]?.lat,
            longitude: draftPoints[0]?.lng
          };

    const response = await fetch(`/api/features/${editingFeature.kind}/${editingFeature.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error ?? "Failed to update geometry");
    }

    const updatedFeature = body?.feature;
    if (!updatedFeature) {
      throw new Error("Missing updated feature");
    }

    setFeatureOverrides((current) => ({
      ...current,
      [`${updatedFeature.kind}:${updatedFeature.id}`]: {
        ...(current[`${updatedFeature.kind}:${updatedFeature.id}`] ?? {}),
        ...updatedFeature,
        geometry: editingFeature.kind === "event" ? {
          type: "Polygon",
          coordinates: [[
            ...draftPoints.map((point) => [point.lng, point.lat]),
            [draftPoints[0].lng, draftPoints[0].lat]
          ]]
        } : undefined,
        latitude: editingFeature.kind !== "event" ? draftPoints[0]?.lat : undefined,
        longitude: editingFeature.kind !== "event" ? draftPoints[0]?.lng : undefined
      }
    }));

    if (editingFeature.kind === "prospect") {
      refreshProspects();
      void onDatasetsChanged();
    } else {
      const dateValue = editingFeature.kind === "event" ? editingFeature.eventDate : editingFeature.findDate;
      const year = Number.parseInt(String(dateValue ?? "").slice(0, 4), 10);
      if (Number.isFinite(year)) {
        refreshYear(year);
      }
      void onDatasetsChanged();
    }

    clearDraft();
  };

  const createEvent = async (values) => {
    const response = await fetch("/api/features/event", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: values.title,
        date: values.date,
        durationMinutes: values.durationMinutes,
        deviceUsed: values.deviceUsed,
        deviceMode: values.deviceMode,
        description: values.description,
        fillColor: values.fillColor,
        outlineColor: values.outlineColor,
        images: values.images,
        points: draftPoints
      })
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(buildApiErrorMessage(body, "Failed to create event"));
    }

    const event = body?.event;
    if (!event) {
      throw new Error("Missing event payload");
    }

    const eventYear = getYearFromDateLike(event.eventDate) ?? getYearFromDateLike(values.date);
    if (eventYear !== null) {
      if (activeYears.includes(eventYear)) {
        await reloadYearLayer(eventYear);
      } else {
        refreshYear(eventYear);
      }
    }

    void onDatasetsChanged();
    setFeatureOverrides((current) => ({
      ...current,
      [`event:${event.id}`]: event
    }));
    setSelectedFeature(null);
    clearDraft();

    if (mapRef.current && event.geometry) {
      const bounds = L.geoJSON(event.geometry).getBounds();
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, {
          padding: [40, 40],
          maxZoom: 17
        });
      }
    }
  };

  const createFind = async (values) => {
    const response = await fetch("/api/features/find", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: values.title,
        date: values.date,
        ageLabel: values.ageLabel,
        type: values.type,
        metal: values.metal,
        itemCount: values.itemCount,
        description: values.description,
        images: values.images,
        point: draftPoints[0]
      })
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error ?? "Failed to create find");
    }

    const find = body?.find;
    if (!find) {
      throw new Error("Missing find payload");
    }

    const findYear = getYearFromDateLike(find.findDate) ?? getYearFromDateLike(values.date);
    if (findYear !== null) {
      if (activeYears.includes(findYear)) {
        await reloadYearLayer(findYear);
      } else {
        refreshYear(findYear);
      }
    }

    void onDatasetsChanged();
    setFeatureOverrides((current) => ({
      ...current,
      [`find:${find.id}`]: find
    }));
    setSelectedFeature(null);
    clearDraft();

    if (mapRef.current) {
      mapRef.current.setView([find.latitude, find.longitude], Math.max(mapRef.current.getZoom(), 17), {
        animate: true
      });
    }
  };

  const createFeature = async (values) => {
    if (creationMode === "find") {
      await createFind(values);
      return;
    }

    if (creationMode === "prospect") {
      const response = await fetch("/api/features/prospect", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: values.title,
          date: values.date,
          ageLabel: values.ageLabel,
          markerColor: values.markerColor,
          description: values.description,
          images: values.images,
          point: draftPoints[0]
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to create prospect");
      }

      const prospect = body?.prospect;
      if (!prospect) {
        throw new Error("Missing prospect payload");
      }

      if (prospectsActive) {
        await reloadProspectLayer();
      } else {
        refreshProspects();
      }
      void onDatasetsChanged();
      setFeatureOverrides((current) => ({
        ...current,
        [`prospect:${prospect.id}`]: prospect
      }));
      setSelectedFeature(null);
      clearDraft();

      if (mapRef.current) {
        mapRef.current.setView(
          [prospect.latitude, prospect.longitude],
          Math.max(mapRef.current.getZoom(), 17),
          { animate: true }
        );
      }
      return;
    }

    await createEvent(values);
  };

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

        const payload = await fetchYearFeatures(year);
        if (cancelled || mapRef.current !== map || !map.getContainer() || !payload) {
          continue;
        }
        if (cancelled || mapRef.current !== map || !map.getContainer()) {
          return;
        }

        const layerGroup = buildYearLayerGroup(payload);

        if (cancelled || mapRef.current !== map || !map.getContainer()) {
          return;
        }

        layerGroup.addTo(map);
        datasetLayerRefs.current.set(key, layerGroup);
      }

      if (prospectsActive && !datasetLayerRefs.current.has("prospects")) {
        const payload = await fetchProspectFeatures();
        if (cancelled || mapRef.current !== map || !map.getContainer() || !payload) {
          return;
        }
        if (cancelled || mapRef.current !== map || !map.getContainer()) {
          return;
        }

        const layerGroup = buildProspectLayerGroup(payload);

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
  }, [activeYears, datasetRefreshToken, editingFeature, prospectsActive]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),transparent_45%),linear-gradient(180deg,#dce8ef_0%,#c3d2db_100%)] p-8 max-[700px]:p-4">
      <section className="relative z-[4000] mx-auto mb-5 flex max-w-[1400px] items-center justify-between gap-6 max-[700px]:mb-4 max-[700px]:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-3 max-[700px]:gap-2.5">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-[#eaf1f5] to-[#d6e2e8] text-[#15313f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <MapIcon size={24} strokeWidth={2.1} />
            </span>
            <h1 className="m-0 min-w-0 text-[clamp(28px,4vw,44px)] leading-[0.95] text-[#15313f] max-[700px]:text-[24px]">
              Time Travel Map
            </h1>
          </div>
        </div>
        <div className="relative z-[4001] flex shrink-0 items-center gap-3">
          {currentUserId ? (
            <UserButton />
          ) : (
            <Button
              type="button"
              onClick={() => {
                setShowAuthModal(true);
              }}
              className="inline-flex items-center gap-2"
            >
              <LogIn size={15} strokeWidth={2.2} />
              <span>Sign In</span>
            </Button>
          )}
        </div>
      </section>

      <Card className="mx-auto max-w-[1400px]">
        <div className="m-0 flex items-center justify-between gap-4 border-b border-[rgba(21,49,63,0.08)] bg-gradient-to-b from-[rgba(240,246,249,0.96)] to-[rgba(232,239,243,0.96)] px-4 py-[14px] max-[700px]:gap-3 max-[700px]:p-3">
          <div className="flex min-w-0 items-center gap-3 max-[700px]:hidden">
            <div className="inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#5a6d78]">
              <Layers3 size={15} strokeWidth={2.2} />
              <span>Map Controls</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 max-[700px]:gap-2 max-[700px]:items-center">
            <div className="flex min-w-0 items-center gap-3 max-[700px]:flex-1 max-[700px]:gap-1.5">
            {creationMode ? (
              <>
                <div className="rounded-[10px] border border-[rgba(21,49,63,0.12)] bg-[rgba(255,255,255,0.78)] px-3 py-2 text-[13px] font-semibold text-[#526773] max-[700px]:hidden">
                  {editingFeature
                    ? editingFeature.kind === "event"
                      ? "Adjust polygon points, then save shape"
                      : "Click map to move the pin, then save"
                    : creationMode === "event"
                      ? "Click map to add polygon points"
                      : creationMode === "prospect"
                        ? "Click map to place a prospect pin"
                        : "Click map to place a find pin"}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={undoDraftPoint}
                  disabled={draftPoints.length === 0}
                  className="inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 max-[700px]:px-2.5"
                >
                  <Undo2 size={15} strokeWidth={2.2} />
                  <span className="max-[700px]:sr-only">Undo</span>
                </Button>

                <Button
                  type="button"
                  onClick={finishDraft}
                  disabled={
                    creationMode === "event" ? draftPoints.length < 3 : draftPoints.length < 1
                  }
                  className="inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 max-[700px]:px-2.5"
                >
                  <Check size={15} strokeWidth={2.2} />
                  <span className="max-[700px]:sr-only">
                    {editingFeature
                      ? editingFeature.kind === "event"
                        ? "Save Shape"
                        : "Save Move"
                      : creationMode === "event"
                        ? "Finish Event"
                        : creationMode === "prospect"
                          ? "Save Prospect"
                          : "Save Find"}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearDraft}
                  className="inline-flex items-center gap-2 max-[700px]:px-2.5"
                >
                  <X size={15} strokeWidth={2.2} />
                  <span className="max-[700px]:sr-only">Cancel</span>
                </Button>
              </>
            ) : (
              <>
                {currentUserId ? (
                  <>
                    <Button
                      type="button"
                      onClick={startEventDraw}
                      className="inline-flex items-center gap-2 max-[700px]:px-2.5"
                    >
                      <PencilRuler size={15} strokeWidth={2.2} />
                      <span className="max-[700px]:sr-only">New Event</span>
                    </Button>

                    <Button
                      type="button"
                      onClick={startFindDraw}
                      className="inline-flex items-center gap-2 max-[700px]:px-2.5"
                    >
                      <Coins size={15} strokeWidth={2.2} />
                      <span className="max-[700px]:sr-only">New Find</span>
                    </Button>

                    <Button
                      type="button"
                      onClick={startProspectDraw}
                      className="inline-flex items-center gap-2 max-[700px]:px-2.5"
                    >
                      <MapPinned size={15} strokeWidth={2.2} />
                      <span className="max-[700px]:sr-only">New Prospect</span>
                    </Button>

                    <Button
                      type="button"
                      onClick={zoomToCurrentLocation}
                      className="inline-flex items-center gap-2 max-[700px]:px-2.5"
                    >
                      <Crosshair size={15} strokeWidth={2.2} />
                      <span className="max-[700px]:sr-only">Current Location</span>
                    </Button>
                  </>
                ) : (
                  <div />
                )}
              </>
            )}

            <Button
              type="button"
              onClick={toggleLayers}
              className="inline-flex items-center gap-2 max-[700px]:px-2.5"
            >
              {layersVisible ? (
                <Eye size={15} strokeWidth={2.2} />
              ) : (
                <EyeOff size={15} strokeWidth={2.2} />
              )}
              <span className="max-[700px]:sr-only">
                {layersVisible ? "Hide Layers" : "Show Layers"}
              </span>
            </Button>
            </div>

            <div
              className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[rgba(21,49,63,0.08)] bg-[rgba(255,255,255,0.52)] px-3 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#5a6d78] max-[700px]:px-2.5 ${
                creationMode ? "max-[700px]:hidden" : ""
              }`}
            >
              <Search size={15} strokeWidth={2.2} />
              <span>{zoomLabel}</span>
            </div>
          </div>
        </div>

        <div className="relative m-0 h-[min(72vh,900px)] overflow-hidden bg-[#d9e3ea] max-[700px]:h-[68vh]">
          <div ref={mapElementRef} className="h-full w-full" />
        </div>

        <TimelineSlider
          labels={sliderValues}
          max={layerDefinitions.length - 1}
          value={sliderValue}
          onChange={handleSliderChange}
          disabled={timelineLocked}
          reversed
        />
      </Card>

      {currentUserId ? (
        <DatasetsCard
          years={datasets?.years ?? []}
          prospectCount={datasets?.prospects?.count ?? 0}
          prospectEntries={datasets?.prospects?.entries ?? []}
          loading={datasets?.loading}
          debug={datasetDebug}
          activeYears={activeYears}
          prospectsActive={prospectsActive}
          onToggleYear={onToggleYear}
          onSelectEntry={(year, entry) => {
            void focusDatasetEntry(year, entry);
          }}
          onSelectProspect={(prospectId) => {
            void focusProspectEntry(prospectId);
          }}
          onToggleProspects={onToggleProspects}
        />
      ) : null}

      <FeatureDetailsModal
        feature={selectedFeature}
        currentUserId={currentUserId}
        onClose={() => setSelectedFeature(null)}
        onFeatureChange={(feature) => {
          const previousFeature =
            selectedFeature && selectedFeature.kind === feature.kind && selectedFeature.id === feature.id
              ? selectedFeature
              : null;

          setSelectedFeature(feature);
          setFeatureOverrides((current) => ({
            ...current,
            [`${feature.kind}:${feature.id}`]: feature
          }));

          if (feature.kind === "prospect") {
            refreshProspects();
            void onDatasetsChanged();
            return;
          }

          const previousYear = getYearFromDateLike(
            previousFeature?.kind === "event" ? previousFeature?.eventDate : previousFeature?.findDate
          );
          const nextYear = getYearFromDateLike(
            feature.kind === "event" ? feature.eventDate : feature.findDate
          );

          if (previousYear !== null) {
            refreshActiveYearLayer(previousYear);
          }

          if (nextYear !== null && nextYear !== previousYear) {
            refreshActiveYearLayer(nextYear);
          }

          void onDatasetsChanged();
        }}
        onFeatureDelete={(feature) => {
          setSelectedFeature(null);
          setFeatureOverrides((current) => {
            const next = { ...current };
            delete next[`${feature.kind}:${feature.id}`];
            return next;
          });

          if (feature.kind === "prospect") {
            refreshProspects();
            void onDatasetsChanged();
            return;
          }

          const dateValue = feature.kind === "event" ? feature.eventDate : feature.findDate;
          const year = Number.parseInt(String(dateValue ?? "").slice(0, 4), 10);
          if (Number.isFinite(year)) {
            refreshYear(year);
          }
          void onDatasetsChanged();
        }}
        onFeatureMove={(feature) => {
          void beginFeatureMove(feature);
        }}
      />

      <CreateFeatureModal
        open={showCreateFeatureModal}
        mode={creationMode === "find" ? "find" : creationMode === "prospect" ? "prospect" : "event"}
        pointCount={draftPoints.length}
        onClose={() => setShowCreateFeatureModal(false)}
        onSubmit={createFeature}
      />

      {showAuthModal ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close sign in"
            className="absolute inset-0"
            onClick={() => {
              setShowAuthModal(false);
            }}
          />
          <div className="relative z-[1201] w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.22)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Account
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  Sign In
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  setAuthPending(false);
                  setAuthError("");
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Close sign in panel"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">
                Sign in with your Google account to manage your events, finds, prospects, and images.
              </p>
              <Button
                type="button"
                onClick={() => {
                  void beginGoogleSignIn();
                }}
                disabled={authPending}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border-slate-200 bg-white py-4 text-[15px] font-semibold text-slate-900 shadow-none hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
              >
                <BrandIcons.Google iconSize={20} />
                <span>{authPending ? "Opening Google…" : "Sign in with Google"}</span>
              </Button>
              {authError ? <p className="text-sm text-rose-600">{authError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      </main>
  );
}
