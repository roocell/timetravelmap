"use client";

import {
  CalendarDays,
  Clock3,
  Coins,
  MapPinned,
  Radar,
  Save,
  X
} from "lucide-react";
import {
  useEffect,
  useRef,
  useId,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode
} from "react";

type FeatureImage = {
  src: string;
  altText?: string | null;
  caption?: string | null;
};

export type CreateFeatureValues = {
  title: string;
  date: string;
  description: string;
  images: FeatureImage[];
  durationMinutes: string;
  deviceUsed: string;
  deviceMode: string;
  fillColor: string;
  outlineColor: string;
  ageLabel: string;
  type: string;
  metal: string;
  itemCount: string;
};

type CreateFeatureModalProps = {
  open: boolean;
  mode: "event" | "find" | "prospect";
  pointCount: number;
  onClose: () => void;
  onSubmit: (values: CreateFeatureValues) => Promise<void>;
};

function getTodayValue() {
  return new Date().toISOString().slice(0, 10);
}

function getInitialValues(): CreateFeatureValues {
  return {
    title: "",
    date: getTodayValue(),
    description: "",
    images: [],
    durationMinutes: "",
    deviceUsed: "",
    deviceMode: "",
    fillColor: "#ffffff",
    outlineColor: "#f0c419",
    ageLabel: "",
    type: "other",
    metal: "",
    itemCount: ""
  };
}

function Field({
  label,
  icon,
  className = "",
  children
}: {
  label: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`grid content-start gap-2 self-start ${className}`}>
      <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
        {icon}
        <span>{label}</span>
      </span>
      {children}
    </label>
  );
}

function getModalCopy(mode: "event" | "find" | "prospect", pointCount: number) {
  if (mode === "find") {
    return {
      eyebrow: "New Find",
      title: "Save Map Pin",
      helper:
        pointCount > 0
          ? "Pin captured. Add the find details, then save it into the map."
          : "Click the map to place a find pin, then save its details."
    };
  }

  if (mode === "prospect") {
    return {
      eyebrow: "New Prospect",
      title: "Save Prospect Pin",
      helper:
        pointCount > 0
          ? "Pin captured. Add the prospect details, then save it into the map."
          : "Click the map to place a prospect pin, then save its details."
    };
  }

  return {
    eyebrow: "New Event",
    title: "Save Drawn Polygon",
    helper: `${pointCount} points captured. Add the event details, then save it into the map.`
  };
}

export default function CreateFeatureModal({
  open,
  mode,
  pointCount,
  onClose,
  onSubmit
}: CreateFeatureModalProps) {
  const [values, setValues] = useState<CreateFeatureValues>(getInitialValues());
  const [saving, setSaving] = useState(false);
  const [imageSaving, setImageSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues(getInitialValues());
    setSaving(false);
    setImageSaving(false);
    setDragActive(false);
    setError(null);
  }, [open, mode]);

  if (!open) {
    return null;
  }

  const copy = getModalCopy(mode, pointCount);

  const updateValue = (key: keyof CreateFeatureValues, value: string) => {
    setValues((current) => ({
      ...current,
      [key]: value
    }));
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) {
      return;
    }

    setImageSaving(true);
    setError(null);

    try {
      const uploadedImages: CreateFeatureValues["images"] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/uploads/images", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? `Failed to upload ${file.name}`);
        }

        const upload = await response.json();
        uploadedImages.push({
          src: upload.src,
          altText: upload.altText ?? file.name,
          caption: ""
        });
      }

      setValues((current) => ({
        ...current,
        images: [...current.images, ...uploadedImages]
      }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload images");
    } finally {
      setImageSaving(false);
      setDragActive(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragActive(false);

    const files = Array.from(event.dataTransfer.files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );

    await uploadFiles(files);
  };

  const removeImage = (src: string) => {
    setValues((current) => ({
      ...current,
      images: current.images.filter((image) => image.src !== src)
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : `Failed to create ${mode}`
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto bg-[rgba(15,29,39,0.6)] p-4 backdrop-blur-sm max-[700px]:px-3 max-[700px]:py-4">
      <div className="flex min-h-full items-center justify-center max-[700px]:items-start">
        <div className="my-auto w-full max-w-3xl rounded-[28px] border border-[rgba(33,55,70,0.14)] bg-[rgba(250,252,253,0.98)] shadow-[0_30px_100px_rgba(14,31,41,0.28)] max-[700px]:my-0 max-[700px]:rounded-[24px]">
        <div className="flex items-start justify-between gap-4 px-6 pb-1 pt-4">
          <div className="grid gap-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6a7d88]">
              {copy.eyebrow}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(21,49,63,0.1)] bg-white text-[#526773] shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 px-6 pb-6 pt-3">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="min-w-0 grid gap-4">
              <Field
                label="Title"
                icon={
                  mode === "event" ? (
                    <MapPinned size={14} strokeWidth={2.1} />
                  ) : mode === "prospect" ? (
                    <MapPinned size={14} strokeWidth={2.1} />
                  ) : (
                    <Coins size={14} strokeWidth={2.1} />
                  )
                }
              >
                <input
                  value={values.title}
                  onChange={(event) => updateValue("title", event.currentTarget.value)}
                  placeholder={
                    mode === "event"
                      ? "South field after rain"
                      : mode === "prospect"
                        ? "Old schoolyard"
                        : "1905 barber dime"
                  }
                  className="rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                  required
                />
              </Field>

              <Field
                label="Description"
                icon={
                  mode === "event" ? (
                    <Radar size={14} strokeWidth={2.1} />
                  ) : mode === "prospect" ? (
                    <MapPinned size={14} strokeWidth={2.1} />
                  ) : (
                    <Coins size={14} strokeWidth={2.1} />
                  )
                }
              >
                <textarea
                  value={values.description}
                  onChange={(event) => updateValue("description", event.currentTarget.value)}
                  placeholder={
                    mode === "event"
                      ? "Notes about the outing, conditions, permissions, and anything worth keeping."
                      : mode === "prospect"
                        ? "Notes about the site, access, clues, and why it looks promising."
                      : "Notes about the find, location context, and condition."
                  }
                  className="min-h-40 rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                />
              </Field>

              <div className="grid gap-2">
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#6a7d88]">
                  <MapPinned size={14} strokeWidth={2.1} />
                  <span>Images</span>
                </span>

                <label
                  htmlFor={fileInputId}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    const relatedTarget = event.relatedTarget as Node | null;
                    if (!event.currentTarget.contains(relatedTarget)) {
                      setDragActive(false);
                    }
                  }}
                  onDrop={handleDrop}
                  className={`relative block cursor-pointer rounded-[24px] border border-dashed px-5 py-8 text-left transition ${
                    dragActive
                      ? "border-[#0f5e7d] bg-[rgba(140,201,222,0.18)]"
                      : "border-[rgba(21,49,63,0.16)] bg-[rgba(255,255,255,0.5)]"
                  }`}
                >
                  <input
                    id={fileInputId}
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={(event) => {
                      const files = Array.from(event.currentTarget.files ?? []);
                      void uploadFiles(files);
                    }}
                  />
                  <div className="grid gap-1">
                    <span className="text-[14px] font-semibold text-[#15313f]">
                      {imageSaving ? "Uploading images..." : "Drop images here or click to upload"}
                    </span>
                    <span className="text-[13px] text-[#6a7d88]">
                      Add one or many images before saving the {mode}.
                    </span>
                  </div>
                </label>

                {values.images.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {values.images.map((image) => (
                      <div
                        key={image.src}
                        className="overflow-hidden rounded-[20px] border border-[rgba(21,49,63,0.08)] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                      >
                        <div className="aspect-square overflow-hidden bg-[rgba(21,49,63,0.04)]">
                          <img
                            src={image.src}
                            alt={image.altText ?? "Uploaded feature image"}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-end p-2">
                          <button
                            type="button"
                            onClick={() => removeImage(image.src)}
                            className="rounded-xl border border-[rgba(21,49,63,0.12)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#526773]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 content-start self-start grid gap-4">
              <Field label={mode === "prospect" ? "Visited" : "Date"} icon={<CalendarDays size={14} strokeWidth={2.1} />}>
                <input
                  type="date"
                  value={values.date}
                  onChange={(event) => updateValue("date", event.currentTarget.value)}
                  className="rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                  required={mode !== "prospect"}
                />
              </Field>

              {mode === "event" ? (
                <>
                  <Field label="Duration Minutes" icon={<Clock3 size={14} strokeWidth={2.1} />}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={values.durationMinutes}
                      onChange={(event) => updateValue("durationMinutes", event.currentTarget.value)}
                      placeholder="180"
                      className="rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                    />
                  </Field>

                  <Field label="Device Used" icon={<Radar size={14} strokeWidth={2.1} />}>
                    <input
                      value={values.deviceUsed}
                      onChange={(event) => updateValue("deviceUsed", event.currentTarget.value)}
                      placeholder="nox600"
                      className="rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                    />
                  </Field>

                  <Field label="Device Mode" icon={<Radar size={14} strokeWidth={2.1} />}>
                    <input
                      value={values.deviceMode}
                      onChange={(event) => updateValue("deviceMode", event.currentTarget.value)}
                      placeholder="f2am"
                      className="rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Fill" icon={<span className="h-3 w-3 rounded-full bg-white ring-1 ring-[rgba(21,49,63,0.16)]" />}>
                      <input
                        type="color"
                        value={values.fillColor}
                        onChange={(event) => updateValue("fillColor", event.currentTarget.value)}
                        className="h-12 w-full rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white p-1.5"
                      />
                    </Field>

                    <Field label="Outline" icon={<span className="h-3 w-3 rounded-full bg-[#f0c419]" />}>
                      <input
                        type="color"
                        value={values.outlineColor}
                        onChange={(event) => updateValue("outlineColor", event.currentTarget.value)}
                        className="h-12 w-full rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white p-1.5"
                      />
                    </Field>
                  </div>
                </>
              ) : mode === "find" ? (
                <>
                  <Field label="Age" icon={<CalendarDays size={14} strokeWidth={2.1} />}>
                    <input
                      value={values.ageLabel}
                      onChange={(event) => updateValue("ageLabel", event.currentTarget.value)}
                      placeholder="1905 or 1800s"
                      className="rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                    />
                  </Field>

                  <Field label="Type" icon={<Coins size={14} strokeWidth={2.1} />}>
                    <select
                      value={values.type}
                      onChange={(event) => updateValue("type", event.currentTarget.value)}
                      className="rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                    >
                      <option value="coin">Coin</option>
                      <option value="ring">Ring</option>
                      <option value="jewelry">Jewelry</option>
                      <option value="artifact">Artifact</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Metal" icon={<Coins size={14} strokeWidth={2.1} />}>
                      <select
                        value={values.metal}
                        onChange={(event) => updateValue("metal", event.currentTarget.value)}
                        className="w-full min-w-0 rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                      >
                        <option value="">None</option>
                        <option value="C">Copper</option>
                        <option value="S">Silver</option>
                        <option value="G">Gold</option>
                      </select>
                    </Field>

                    <Field label="Count" icon={<Coins size={14} strokeWidth={2.1} />}>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={values.itemCount}
                        onChange={(event) => updateValue("itemCount", event.currentTarget.value)}
                        placeholder="1"
                        className="w-full min-w-0 rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                      />
                    </Field>
                  </div>
                </>
              ) : (
                <div className="grid content-start items-start gap-4 sm:grid-cols-2">
                  <Field label="Age" icon={<CalendarDays size={14} strokeWidth={2.1} />}>
                    <input
                      value={values.ageLabel}
                      onChange={(event) => updateValue("ageLabel", event.currentTarget.value)}
                      placeholder="1800s or early 1900s"
                      className="rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-[15px] text-[#15313f] outline-none"
                    />
                  </Field>
                  <div className="hidden sm:block" />
                </div>
              )}
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-[rgba(179,54,54,0.18)] bg-[rgba(255,240,240,0.92)] px-4 py-3 text-sm text-[#8f2b2b]">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-[rgba(21,49,63,0.08)] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[rgba(21,49,63,0.12)] bg-white px-4 py-3 text-sm font-semibold text-[#526773]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#15313f] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(21,49,63,0.2)]"
            >
              <Save size={16} strokeWidth={2.1} />
              <span>
                {saving
                  ? "Saving..."
                  : `Save ${mode === "event" ? "Event" : mode === "find" ? "Find" : "Prospect"}`}
              </span>
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
