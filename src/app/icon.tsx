import { ImageResponse } from "next/og";
import { AkashicMark } from "@/components/brand/AkashicMark";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f5ee",
          color: "#1c1a14",
        }}
      >
        <AkashicMark size={52} color="#1c1a14" />
      </div>
    ),
    size,
  );
}
