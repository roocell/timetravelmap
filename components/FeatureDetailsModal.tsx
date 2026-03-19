"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  MapPinned,
  Radar,
  X
} from "lucide-react";
import { useEffect, useState } from "react";

type FeatureImage = {
  src: string;
  altText?: string | null;
  caption?: string | null;
};

type FeatureDetails = {
  kind: "event" | "find" | "prospect";
  title: string;
  description?: string | null;
  eventDate?: string | null;
  findDate?: string | null;
  dateVisited?: string | null;
  durationMinutes?: number | null;
  deviceUsed?: string | null;
  deviceMode?: string | null;
  ageLabel?: string | null;
  type?: string | null;
  metal?: string | null;
  itemCount?: number | null;
  images?: FeatureImage[];
};

type FeatureDetailsModalProps = {
  feature: FeatureDetails | null;
  onClose: () => void;
};

function formatDate(value?: string | null) {
  return value ? String(value).slice(0, 10) : null;
}

function formatDuration(minutes?: number | null) {
  if (!minutes) {
    return null;
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60} hr`;
  }

  if (minutes > 60) {
    return `${(minutes / 60).toFixed(1)} hr`;
  }

  return `${minutes} min`;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="grid gap-1 rounded-2xl border border-[rgba(21,49,63,0.08)] bg-[rgba(247,250,252,0.9)] px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
        {label}
      </span>
      <span className="text-[15px] font-semibold text-[#15313f]">{value}</span>
    </div>
  );
}

export default function FeatureDetailsModal({
  feature,
  onClose
}: FeatureDetailsModalProps) {
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  useEffect(() => {
    setGalleryIndex(null);
  }, [feature]);

  if (!feature) {
    return null;
  }

  const images = feature.images ?? [];
  const primaryImage = images[0];
  const galleryImage =
    galleryIndex === null ? null : images[((galleryIndex % images.length) + images.length) % images.length];
  const currentGalleryPosition =
    galleryIndex === null ? null : ((galleryIndex % images.length) + images.length) % images.length;
  const eventDate = formatDate(feature.eventDate);
  const findDate = formatDate(feature.findDate);
  const visitedDate = formatDate(feature.dateVisited);
  const duration = formatDuration(feature.durationMinutes);

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-[rgba(7,18,24,0.58)] p-4 backdrop-blur-[2px]">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.22)] bg-[linear-gradient(180deg,#f8fbfc_0%,#eef4f7_100%)] shadow-[0_30px_90px_rgba(7,18,24,0.35)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(21,49,63,0.1)] bg-white/90 text-[#15313f] shadow-sm transition hover:bg-white"
          aria-label="Close details"
        >
          <X size={18} strokeWidth={2.2} />
        </button>

        <div className="max-h-[90vh] overflow-y-auto">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border-b border-[rgba(21,49,63,0.08)] p-6 lg:border-b-0 lg:border-r">
              <div className="mb-5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
                {feature.kind === "event" ? (
                  <Radar size={15} strokeWidth={2.1} />
                ) : feature.kind === "find" ? (
                  <Coins size={15} strokeWidth={2.1} />
                ) : (
                  <MapPinned size={15} strokeWidth={2.1} />
                )}
                <span>{feature.kind}</span>
              </div>

              <h2 className="mb-3 pr-14 text-3xl font-semibold leading-tight text-[#15313f]">
                {feature.title}
              </h2>

              {feature.description ? (
                <p className="mb-6 whitespace-pre-line text-[15px] leading-7 text-[#445965]">
                  {feature.description}
                </p>
              ) : null}

              {primaryImage ? (
                <button
                  type="button"
                  onClick={() => setGalleryIndex(0)}
                  className="block w-full overflow-hidden rounded-[24px] border border-[rgba(21,49,63,0.08)] bg-white text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                >
                  <img
                    src={primaryImage.src}
                    alt={primaryImage.altText ?? feature.title}
                    className="h-[360px] w-full object-cover"
                  />
                  {primaryImage.caption ? (
                    <div className="border-t border-[rgba(21,49,63,0.08)] px-4 py-3 text-[13px] text-[#526773]">
                      {primaryImage.caption}
                    </div>
                  ) : null}
                </button>
              ) : null}

            </div>

            <div className="grid content-start gap-3 p-6">
              <div className="mb-1 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
                <CalendarDays size={15} strokeWidth={2.1} />
                <span>Details</span>
              </div>

              <DetailRow label="Event Date" value={eventDate} />
              <DetailRow label="Find Date" value={findDate} />
              <DetailRow label="Visited" value={visitedDate} />
              <DetailRow label="Duration" value={duration} />
              <DetailRow label="Device" value={feature.deviceUsed} />
              <DetailRow label="Mode" value={feature.deviceMode} />
              <DetailRow label="Age" value={feature.ageLabel} />
              <DetailRow label="Type" value={feature.type} />
              <DetailRow label="Metal" value={feature.metal} />
              <DetailRow
                label="Count"
                value={feature.itemCount ? String(feature.itemCount) : null}
              />

              <div className="mt-2 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
                <Clock3 size={15} strokeWidth={2.1} />
                <span>{images.length} image{images.length === 1 ? "" : "s"}</span>
              </div>

              {images.length > 1 ? (
                <div className="mt-2 grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1">
                  {images.map((image, index) => (
                    <button
                      type="button"
                      key={`${image.src}-${index}`}
                      onClick={() => setGalleryIndex(index)}
                      className="overflow-hidden rounded-2xl border border-[rgba(21,49,63,0.08)] bg-white"
                    >
                      <img
                        src={image.src}
                        alt={image.altText ?? `${feature.title} image ${index + 1}`}
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {galleryImage ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-[rgba(5,12,18,0.82)] p-4 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setGalleryIndex(null)}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close image gallery"
          >
            <X size={18} strokeWidth={2.2} />
          </button>

          {images.length > 1 ? (
            <button
              type="button"
              onClick={() => setGalleryIndex((current) => (current ?? 0) - 1)}
              className="absolute left-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Previous image"
            >
              <ChevronLeft size={22} strokeWidth={2.2} />
            </button>
          ) : null}

          <div className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/12 bg-[rgba(12,21,28,0.92)] shadow-[0_30px_90px_rgba(0,0,0,0.4)]">
            <img
              src={galleryImage.src}
              alt={galleryImage.altText ?? feature.title}
              className="max-h-[78vh] w-full object-contain"
            />

            <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4 text-white/80 max-[700px]:flex-col max-[700px]:items-start">
              <div className="text-sm">
                {galleryImage.caption ?? galleryImage.altText ?? feature.title}
              </div>
              <div className="text-xs font-bold uppercase tracking-[0.08em] text-white/60">
                {(currentGalleryPosition ?? 0) + 1} / {images.length}
              </div>
            </div>
          </div>

          {images.length > 1 ? (
            <button
              type="button"
              onClick={() => setGalleryIndex((current) => (current ?? 0) + 1)}
              className="absolute right-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Next image"
            >
              <ChevronRight size={22} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
