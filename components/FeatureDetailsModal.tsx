"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  ImageUp,
  MapPinned,
  Radar,
  Save,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";

type FeatureImage = {
  src: string;
  altText?: string | null;
  caption?: string | null;
};

export type FeatureDetails = {
  id: string;
  kind: "event" | "find" | "prospect";
  ownerId?: string | null;
  title: string;
  description?: string | null;
  eventDate?: string | null;
  findDate?: string | null;
  dateVisited?: string | null;
  durationMinutes?: number | null;
  areaM2?: number | null;
  deviceUsed?: string | null;
  deviceMode?: string | null;
  ageLabel?: string | null;
  type?: string | null;
  metal?: string | null;
  itemCount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  geometry?: {
    type: string;
    coordinates: unknown;
  } | null;
  images?: FeatureImage[];
};

type FeatureDetailsModalProps = {
  feature: FeatureDetails | null;
  currentUserId?: string | null;
  onClose: () => void;
  onFeatureChange?: (feature: FeatureDetails) => void;
  onFeatureDelete?: (feature: FeatureDetails) => void;
  onFeatureMove?: (feature: FeatureDetails) => void;
};

type EditableFieldProps = {
  label: string;
  value?: string | number | null;
  placeholder?: string;
  type?: "text" | "date" | "number" | "textarea" | "select";
  options?: Array<{ label: string; value: string }>;
  onSave: (value: string) => Promise<void>;
  renderPreview?: (value: string) => ReactNode;
};

function DetailShell({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-2xl border border-[rgba(21,49,63,0.08)] bg-[rgba(247,250,252,0.9)] px-4 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
        {label}
      </span>
      {children}
    </div>
  );
}

function ReadonlyField({
  label,
  value,
  placeholder = "Not available",
  renderPreview
}: {
  label: string;
  value?: string | number | null;
  placeholder?: string;
  renderPreview?: (value: string) => ReactNode;
}) {
  const text = value == null ? "" : String(value);

  return (
    <DetailShell label={label}>
      {text && renderPreview ? (
        renderPreview(text)
      ) : (
        <span className={`text-[15px] font-semibold ${text ? "text-[#15313f]" : "text-[#7c909b]"}`}>
          {text || placeholder}
        </span>
      )}
    </DetailShell>
  );
}

function FieldRenderer({
  editable,
  editableProps,
  readonlyProps
}: {
  editable: boolean;
  editableProps: EditableFieldProps;
  readonlyProps?: {
    label: string;
    value?: string | number | null;
    placeholder?: string;
    renderPreview?: (value: string) => ReactNode;
  };
}) {
  if (editable) {
    return <EditableField {...editableProps} />;
  }

  return (
    <ReadonlyField
      label={readonlyProps?.label ?? editableProps.label}
      value={readonlyProps?.value ?? editableProps.value}
      placeholder={readonlyProps?.placeholder ?? editableProps.placeholder}
      renderPreview={readonlyProps?.renderPreview ?? editableProps.renderPreview}
    />
  );
}

function renderRichText(value: string) {
  return value.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
    <p
      key={`paragraph-${paragraphIndex}`}
      className="text-[15px] leading-7 text-[#445965]"
    >
      {paragraph.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
        if (/^https?:\/\/[^\s]+$/.test(part)) {
          return (
            <a
              key={`link-${paragraphIndex}-${index}`}
              href={part}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#0f5e7d] underline underline-offset-4"
            >
              {part}
            </a>
          );
        }

        return (
          <span key={`text-${paragraphIndex}-${index}`} className="whitespace-pre-wrap">
            {part}
          </span>
        );
      })}
    </p>
  ));
}

function formatDateOnly(value: string) {
  return value.slice(0, 10);
}

function formatAreaValue(value?: number | null) {
  const area = Number(value ?? 0);
  if (!Number.isFinite(area) || area <= 0) {
    return null;
  }

  if (area >= 10000) {
    return `${(area / 10000).toFixed(2)} hectares`;
  }

  return `${Math.round(area).toLocaleString()} m²`;
}

function getFindShortLabel(feature: FeatureDetails | null) {
  if (!feature || feature.kind !== "find") {
    return null;
  }

  const type = String(feature.type ?? "").toLowerCase();
  const metal = String(feature.metal ?? "").toUpperCase();
  const title = String(feature.title ?? "").toLowerCase();
  const description = String(feature.description ?? "").toLowerCase();

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

function EditableField({
  label,
  value,
  placeholder = "Click to edit",
  type = "text",
  options = [],
  onSave,
  renderPreview
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
    setEditing(false);
  }, [value]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full text-left"
      >
        <DetailShell label={label}>
          {draft && renderPreview ? (
            renderPreview(draft)
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span
                className={`text-[15px] font-semibold ${
                  draft ? "text-[#15313f]" : "text-[#7c909b]"
                }`}
              >
                {draft || placeholder}
              </span>
            </div>
          )}
        </DetailShell>
      </button>
    );
  }

  return (
    <DetailShell label={label}>
      <div className="grid gap-2">
        {type === "textarea" ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            className="min-h-28 rounded-xl border border-[rgba(21,49,63,0.12)] bg-white px-3 py-2 text-[14px] text-[#15313f] outline-none"
          />
        ) : type === "select" ? (
          <select
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            className="rounded-xl border border-[rgba(21,49,63,0.12)] bg-white px-3 py-2 text-[14px] text-[#15313f] outline-none"
          >
            <option value="">None</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            className="rounded-xl border border-[rgba(21,49,63,0.12)] bg-white px-3 py-2 text-[14px] text-[#15313f] outline-none"
          />
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-xl bg-[#15313f] px-3 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-white"
          >
            <Save size={13} strokeWidth={2.2} />
            <span>{saving ? "Saving" : "Save"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value == null ? "" : String(value));
              setEditing(false);
            }}
            className="rounded-xl border border-[rgba(21,49,63,0.12)] bg-white px-3 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#526773]"
          >
            Cancel
          </button>
        </div>
      </div>
    </DetailShell>
  );
}

export default function FeatureDetailsModal({
  feature,
  currentUserId = null,
  onClose,
  onFeatureChange = () => {},
  onFeatureDelete = () => {},
  onFeatureMove = () => {}
}: FeatureDetailsModalProps) {
  const [draftFeature, setDraftFeature] = useState<FeatureDetails | null>(feature);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageSaving, setImageSaving] = useState(false);
  const [pendingDeleteImageSrc, setPendingDeleteImageSrc] = useState<string | null>(null);
  const [pendingDeleteFeature, setPendingDeleteFeature] = useState(false);
  const [featureDeleting, setFeatureDeleting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftFeature(feature);
    setGalleryIndex(null);
    setError(null);
    setPendingDeleteImageSrc(null);
    setPendingDeleteFeature(false);
    setFeatureDeleting(false);
  }, [feature]);

  const images = draftFeature?.images ?? [];
  const primaryImage = images[0];
  const currentGalleryPosition = useMemo(() => {
    if (galleryIndex === null || images.length === 0) {
      return null;
    }

    return ((galleryIndex % images.length) + images.length) % images.length;
  }, [galleryIndex, images.length]);
  const galleryImage =
    currentGalleryPosition === null ? null : images[currentGalleryPosition];
  const findShortLabel = getFindShortLabel(draftFeature);

  if (!draftFeature) {
    return null;
  }

  const canEdit = Boolean(draftFeature.ownerId && currentUserId && draftFeature.ownerId === currentUserId);

  const pushUpdate = (updatedFeature: FeatureDetails) => {
    const merged = draftFeature ? { ...draftFeature, ...updatedFeature } : updatedFeature;
    setDraftFeature(merged);
    onFeatureChange(merged);
  };

  const patchFeature = async (payload: Record<string, unknown>) => {
    setError(null);

    const response = await fetch(`/api/features/${draftFeature.kind}/${draftFeature.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to update feature");
    }

    const body = await response.json();
    pushUpdate(body.feature);
  };

  const saveField = async (payload: Record<string, unknown>) => {
    try {
      await patchFeature(payload);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save");
      throw saveError;
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setImageSaving(true);
    setError(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch("/api/uploads/images", {
          method: "POST",
          body: formData
        });

        if (!uploadResponse.ok) {
          const body = await uploadResponse.json().catch(() => null);
          throw new Error(body?.error ?? `Failed to upload ${file.name}`);
        }

        const upload = await uploadResponse.json();
        await patchFeature({
          addImage: {
            src: upload.src,
            altText: upload.altText ?? file.name,
            caption: ""
          }
        });
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload image");
    } finally {
      setImageSaving(false);
      setDragActive(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragActive(false);

    const files = Array.from(event.dataTransfer.files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );
    if (files.length === 0) {
      return;
    }

    await uploadFiles(files);
  };

  const handleDeleteImage = async (src: string) => {
    try {
      await patchFeature({
        removeImageSrc: src
      });
      setPendingDeleteImageSrc(null);
      if (galleryImage?.src === src) {
        setGalleryIndex(null);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to remove image");
    }
  };

  const handleDeleteFeature = async () => {
    setFeatureDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/features/${draftFeature.kind}/${draftFeature.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete feature");
      }

      setPendingDeleteFeature(false);
      setFeatureDeleting(false);
      onFeatureDelete(draftFeature);
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete feature");
      setFeatureDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto bg-[rgba(7,18,24,0.58)] p-4 backdrop-blur-[2px] max-[700px]:px-3 max-[700px]:py-4">
      <div className="flex min-h-full items-center justify-center max-[700px]:items-start">
        <div className="relative my-auto w-full max-w-4xl overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.22)] bg-[linear-gradient(180deg,#f8fbfc_0%,#eef4f7_100%)] shadow-[0_30px_90px_rgba(7,18,24,0.35)] max-[700px]:my-0 max-[700px]:rounded-[24px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(21,49,63,0.1)] bg-white/90 text-[#15313f] shadow-sm transition hover:bg-white"
          aria-label="Close details"
        >
          <X size={18} strokeWidth={2.2} />
        </button>

        <div className="max-h-[90vh] overflow-y-auto max-[700px]:max-h-none">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="border-b border-[rgba(21,49,63,0.08)] p-6 lg:border-b-0 lg:border-r">
              <div className="mb-5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
                {draftFeature.kind === "event" ? (
                  <Radar size={15} strokeWidth={2.1} />
                ) : draftFeature.kind === "find" ? (
                  <Coins size={15} strokeWidth={2.1} />
                ) : (
                  <MapPinned size={15} strokeWidth={2.1} />
                )}
                <span>{draftFeature.kind}</span>
                {findShortLabel ? (
                  <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-[#15313f] px-2 py-1 text-[11px] font-extrabold tracking-normal text-white">
                    {findShortLabel}
                  </span>
                ) : null}
              </div>

              {canEdit ? (
                <EditableField
                  label="Title"
                  value={draftFeature.title}
                  onSave={(value) => saveField({ title: value })}
                />
              ) : (
                <ReadonlyField label="Title" value={draftFeature.title} />
              )}

              <div className="mt-4">
                {canEdit ? (
                  <EditableField
                    label="Description"
                    value={draftFeature.description}
                    type="textarea"
                    placeholder="Click to add a description"
                    onSave={(value) => saveField({ description: value })}
                    renderPreview={(value) => <div className="grid gap-3">{renderRichText(value)}</div>}
                  />
                ) : (
                  <ReadonlyField
                    label="Description"
                    value={draftFeature.description}
                    placeholder="No description"
                    renderPreview={(value) => <div className="grid gap-3">{renderRichText(value)}</div>}
                  />
                )}
              </div>

              {primaryImage ? (
                <button
                  type="button"
                  onClick={() => setGalleryIndex(0)}
                  className="mt-4 block w-full overflow-hidden rounded-[24px] border border-[rgba(21,49,63,0.08)] bg-white text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                >
                  <img
                    src={primaryImage.src}
                    alt={primaryImage.altText ?? draftFeature.title}
                    className="h-[360px] w-full object-cover"
                  />
                  {primaryImage.caption ? (
                    <div className="border-t border-[rgba(21,49,63,0.08)] px-4 py-3 text-[13px] text-[#526773]">
                      {primaryImage.caption}
                    </div>
                  ) : null}
                </button>
              ) : (
                <div className="mt-4 rounded-[24px] border border-dashed border-[rgba(21,49,63,0.16)] bg-white/50 px-5 py-10 text-center text-[14px] text-[#6a7d88]">
                  No images yet. Add one from the right panel.
                </div>
              )}
            </div>

            <div className="grid content-start gap-3 p-6">
              <div className="mb-1 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
                <CalendarDays size={15} strokeWidth={2.1} />
                <span>Details</span>
              </div>

              {draftFeature.kind === "event" ? (
                <>
                  <FieldRenderer
                    editable={canEdit}
                    editableProps={{
                      label: "Event Date",
                      value: draftFeature.eventDate,
                      type: "date",
                      onSave: (value) => saveField({ eventDate: value }),
                      renderPreview: (value) => (
                        <span className="text-[15px] font-semibold text-[#15313f]">
                          {formatDateOnly(value)}
                        </span>
                      )
                    }}
                  />
                  <FieldRenderer
                    editable={canEdit}
                    editableProps={{
                      label: "Duration (minutes)",
                      value: draftFeature.durationMinutes,
                      type: "number",
                      placeholder: "Add duration",
                      onSave: (value) => saveField({ durationMinutes: value })
                    }}
                    readonlyProps={{ label: "Duration (minutes)", value: draftFeature.durationMinutes, placeholder: "Not set" }}
                  />
                  <ReadonlyField
                    label="Area"
                    value={formatAreaValue(draftFeature.areaM2)}
                    placeholder="Not available"
                  />
                  <FieldRenderer
                    editable={canEdit}
                    editableProps={{
                      label: "Device",
                      value: draftFeature.deviceUsed,
                      placeholder: "Add device",
                      onSave: (value) => saveField({ deviceUsed: value })
                    }}
                    readonlyProps={{ label: "Device", value: draftFeature.deviceUsed, placeholder: "Not set" }}
                  />
                  <FieldRenderer
                    editable={canEdit}
                    editableProps={{
                      label: "Mode",
                      value: draftFeature.deviceMode,
                      placeholder: "Add mode",
                      onSave: (value) => saveField({ deviceMode: value })
                    }}
                    readonlyProps={{ label: "Mode", value: draftFeature.deviceMode, placeholder: "Not set" }}
                  />
                </>
              ) : null}

              {draftFeature.kind === "find" ? (
                <>
                  <FieldRenderer
                    editable={canEdit}
                    editableProps={{
                      label: "Find Date",
                      value: draftFeature.findDate,
                      type: "date",
                      onSave: (value) => saveField({ findDate: value }),
                      renderPreview: (value) => (
                        <span className="text-[15px] font-semibold text-[#15313f]">
                          {formatDateOnly(value)}
                        </span>
                      )
                    }}
                  />
                  <FieldRenderer
                    editable={canEdit}
                    editableProps={{
                      label: "Age",
                      value: draftFeature.ageLabel,
                      placeholder: "Add age",
                      onSave: (value) => saveField({ ageLabel: value })
                    }}
                    readonlyProps={{ label: "Age", value: draftFeature.ageLabel, placeholder: "Not set" }}
                  />
                  {canEdit ? (
                    <>
                      <EditableField
                        label="Type"
                        value={draftFeature.type}
                        type="select"
                        options={[
                          { label: "Coin", value: "coin" },
                          { label: "Ring", value: "ring" },
                          { label: "Jewelry", value: "jewelry" },
                          { label: "Artifact", value: "artifact" },
                          { label: "Other", value: "other" }
                        ]}
                        onSave={(value) => saveField({ type: value })}
                      />
                      <EditableField
                        label="Metal"
                        value={draftFeature.metal}
                        type="select"
                        options={[
                          { label: "Copper", value: "C" },
                          { label: "Silver", value: "S" },
                          { label: "Gold", value: "G" }
                        ]}
                        onSave={(value) => saveField({ metal: value })}
                      />
                    </>
                  ) : (
                    <>
                      <ReadonlyField label="Type" value={draftFeature.type} placeholder="Not set" />
                      <ReadonlyField label="Metal" value={draftFeature.metal} placeholder="Not set" />
                    </>
                  )}
                  <FieldRenderer
                    editable={canEdit}
                    editableProps={{
                      label: "Count",
                      value: draftFeature.itemCount,
                      type: "number",
                      placeholder: "Add count",
                      onSave: (value) => saveField({ itemCount: value })
                    }}
                    readonlyProps={{ label: "Count", value: draftFeature.itemCount, placeholder: "Not set" }}
                  />
                </>
              ) : null}

              {draftFeature.kind === "prospect" ? (
                <>
                  <FieldRenderer
                    editable={canEdit}
                    editableProps={{
                      label: "Age",
                      value: draftFeature.ageLabel,
                      placeholder: "Add age",
                      onSave: (value) => saveField({ ageLabel: value })
                    }}
                    readonlyProps={{ label: "Age", value: draftFeature.ageLabel, placeholder: "Not set" }}
                  />
                  <FieldRenderer
                    editable={canEdit}
                    editableProps={{
                      label: "Visited",
                      value: draftFeature.dateVisited,
                      type: "date",
                      placeholder: "Add visit date",
                      onSave: (value) => saveField({ dateVisited: value }),
                      renderPreview: (value) => (
                        <span className="text-[15px] font-semibold text-[#15313f]">
                          {formatDateOnly(value)}
                        </span>
                      )
                    }}
                    readonlyProps={{
                      label: "Visited",
                      value: draftFeature.dateVisited,
                      placeholder: "Not set",
                      renderPreview: (value) => (
                        <span className="text-[15px] font-semibold text-[#15313f]">
                          {formatDateOnly(value)}
                        </span>
                      )
                    }}
                  />
                </>
              ) : null}

              <div className="mt-2 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
                <Clock3 size={15} strokeWidth={2.1} />
                <span>{images.length} image{images.length === 1 ? "" : "s"}</span>
              </div>

              {images.length > 0 ? (
                <div className="mt-2 grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1">
                  {images.map((image, index) => (
                    <div
                      key={`${image.src}-${index}`}
                      className="relative overflow-hidden rounded-2xl border border-[rgba(21,49,63,0.08)] bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => setGalleryIndex(index)}
                        className="block w-full"
                      >
                        <img
                          src={image.src}
                          alt={image.altText ?? `${draftFeature.title} image ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPendingDeleteImageSrc(image.src);
                          }}
                          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(7,18,24,0.72)] text-white"
                          aria-label="Delete image"
                        >
                          <Trash2 size={14} strokeWidth={2.2} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {canEdit ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(event) => {
                      void handleDrop(event);
                    }}
                    className={`mb-4 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center transition ${
                      dragActive
                        ? "border-[#15313f] bg-[rgba(21,49,63,0.08)]"
                        : "border-[rgba(21,49,63,0.18)] bg-[rgba(247,250,252,0.9)]"
                    }`}
                  >
                    <ImageUp size={20} className="mb-2 text-[#15313f]" strokeWidth={2.1} />
                    <span className="text-sm font-semibold text-[#15313f]">
                      Drop image{imageSaving ? "s" : ""} here
                    </span>
                    <span className="mt-1 text-xs text-[#6a7d88]">
                      or click to upload one or more images
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const files = Array.from(event.currentTarget.files ?? []);
                      if (files.length > 0) {
                        void uploadFiles(files);
                      }
                    }}
                  />
                  {imageSaving ? (
                    <div className="text-xs font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
                      Uploading images...
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-[rgba(161,39,39,0.18)] bg-[rgba(255,240,240,0.84)] px-4 py-3 text-[13px] text-[#8a2b2b]">
                  {error}
                </div>
              ) : null}

              {canEdit ? (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onFeatureMove(draftFeature);
                        onClose();
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-[rgba(21,49,63,0.14)] bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#15313f]"
                    >
                      <MapPinned size={14} strokeWidth={2.2} />
                      <span>{draftFeature.kind === "event" ? "Edit Shape" : "Move"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPendingDeleteFeature(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#8a2b2b] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-white"
                    >
                      <Trash2 size={14} strokeWidth={2.2} />
                      <span>Delete {draftFeature.kind}</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        </div>
      </div>

      {galleryImage ? (
        <div className="fixed inset-0 z-[5100] flex items-center justify-center bg-[rgba(5,12,18,0.82)] p-4 backdrop-blur-sm">
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
              alt={galleryImage.altText ?? draftFeature.title}
              className="max-h-[78vh] w-full object-contain"
            />

            <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4 text-white/80 max-[700px]:flex-col max-[700px]:items-start">
              <div className="text-sm">
                {galleryImage.caption ?? galleryImage.altText ?? draftFeature.title}
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

      {pendingDeleteImageSrc ? (
        <div className="fixed inset-0 z-[5200] flex items-center justify-center bg-[rgba(7,18,24,0.58)] p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-[24px] border border-[rgba(255,255,255,0.18)] bg-[linear-gradient(180deg,#f8fbfc_0%,#eef4f7_100%)] p-6 shadow-[0_30px_90px_rgba(7,18,24,0.35)]">
            <h3 className="text-lg font-semibold text-[#15313f]">Delete image?</h3>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleDeleteImage(pendingDeleteImageSrc);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#8a2b2b] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-white"
              >
                <Trash2 size={14} strokeWidth={2.2} />
                <span>Delete</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingDeleteImageSrc(null)}
                className="rounded-xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#526773]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteFeature ? (
        <div className="fixed inset-0 z-[5200] flex items-center justify-center bg-[rgba(7,18,24,0.58)] p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-[24px] border border-[rgba(255,255,255,0.18)] bg-[linear-gradient(180deg,#f8fbfc_0%,#eef4f7_100%)] p-6 shadow-[0_30px_90px_rgba(7,18,24,0.35)]">
            <h3 className="text-lg font-semibold text-[#15313f]">Delete {draftFeature.kind}?</h3>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleDeleteFeature();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#8a2b2b] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-60"
                disabled={featureDeleting}
              >
                <Trash2 size={14} strokeWidth={2.2} />
                <span>{featureDeleting ? "Deleting" : "Delete"}</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingDeleteFeature(false)}
                className="rounded-xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#526773]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
