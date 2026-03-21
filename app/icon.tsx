import { ImageResponse } from "next/og";
import { Map } from "lucide-react";

export const size = {
  width: 32,
  height: 32
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(180deg, #e7f0f5 0%, #c9d7df 100%)",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%"
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(21,49,63,0.12)",
            borderRadius: 8,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
            display: "flex",
            height: 24,
            justifyContent: "center",
            width: 24
          }}
        >
          <Map color="#15313f" size={16} strokeWidth={2.2} />
        </div>
      </div>
    ),
    size
  );
}
