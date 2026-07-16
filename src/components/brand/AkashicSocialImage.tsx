import { AkashicMark } from "./AkashicMark";

export const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630,
};

export function AkashicSocialImage() {
  return (
    <div
      style={{
        width: SOCIAL_IMAGE_SIZE.width,
        height: SOCIAL_IMAGE_SIZE.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        background: "#f7f5ee",
        color: "#1c1a14",
      }}
    >
      <AkashicMark size={132} color="#1c1a14" />
      <span
        style={{
          fontFamily: "STIX Two Text",
          fontSize: 132,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: 0,
        }}
      >
        Akashic
      </span>
    </div>
  );
}
