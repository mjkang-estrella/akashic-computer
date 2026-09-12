import { AkashicMark } from "./AkashicMark";

export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 };

export function AkashicSocialImage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#f7f5ee",
        color: "#1c1a14",
        padding: "48px 60px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #ddd6c4",
          paddingBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: "STIX Two Text",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          <AkashicMark size={38} color="#1c1a14" />
          Akashic
        </div>
        <span style={{ fontSize: 18, color: "#6b6557" }}>
          An atlas for open-weight AI
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
        <span
          style={{
            fontFamily: "STIX Two Text",
            fontSize: 72,
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          Open-weight models,
        </span>
        <span
          style={{
            fontFamily: "STIX Two Text",
            fontSize: 72,
            lineHeight: 1.08,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          made legible.
        </span>
      </div>
      <span style={{ marginTop: 25, fontSize: 23, color: "#6b6557" }}>
        Discover the weights. Understand the tradeoffs.
      </span>
      <div
        style={{
          display: "flex",
          marginTop: 42,
          paddingTop: 22,
          borderTop: "1px solid #ddd6c4",
          gap: 16,
        }}
      >
        {["Family", "Release", "Size", "Variant", "Artifact"].map(
          (label, index) => (
            <div
              key={label}
              style={{ display: "flex", alignItems: "center", gap: 16 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid #ddd6c4",
                  background: "#fffdf8",
                  padding: "13px 18px",
                  borderRadius: 7,
                }}
              >
                <span style={{ fontSize: 13, color: "#6b6557" }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 20 }}>{label}</span>
              </div>
              {index < 4 ? (
                <span style={{ fontSize: 21, color: "#6b6557" }}>→</span>
              ) : null}
            </div>
          ),
        )}
      </div>
      <span style={{ marginTop: "auto", fontSize: 16, color: "#6b6557" }}>
        Language · Vision · Images · Video · Audio · Retrieval · 3D · Worlds ·
        Robotics
      </span>
    </div>
  );
}
