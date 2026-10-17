import { AkashicMark } from "./AkashicMark";
import { SOCIAL_IMAGE_SIZE } from "./AkashicSocialImage";

export function ModelSocialImage({
  name,
  facts,
  formats,
}: {
  name: string;
  facts: string[];
  formats: string[];
}) {
  return (
    <div
      style={{
        width: SOCIAL_IMAGE_SIZE.width,
        height: SOCIAL_IMAGE_SIZE.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "#f7f5ee",
        color: "#1c1a14",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <AkashicMark size={52} color="#1c1a14" />
        <span style={{ fontFamily: "STIX Two Text", fontSize: 34, fontWeight: 700 }}>Akashic Computer</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <span
          style={{
            fontFamily: "STIX Two Text",
            fontSize: name.length > 34 ? 64 : 84,
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          {name}
        </span>
        <span style={{ fontSize: 30, color: "#5d5849" }}>{facts.join(" · ")}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {formats.slice(0, 8).map((format) => (
          <span
            key={format}
            style={{
              fontSize: 26,
              padding: "6px 14px",
              borderRadius: 8,
              background: "#ebe7da",
              color: "#3d392e",
            }}
          >
            {format}
          </span>
        ))}
      </div>
    </div>
  );
}
