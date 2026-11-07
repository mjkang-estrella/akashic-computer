export type CapabilityGroup = "flash" | "flagship" | "compact" | "mid-size";
export interface CapabilityMetric {
  id: string;
  name: string;
  unit: "points" | "%";
  protocol: string;
}
export interface CapabilityModel {
  id: string;
  name: string;
  repo: string | null;
  sourceUrl: string;
  configuration: string;
  current: boolean;
  closed: boolean;
  scores: Record<string, number | null>;
  evidence?: Record<string, { url: string; label: string; note?: string }>;
}
export interface CapabilityComparison {
  group: string;
  source: "Artificial Analysis" | "Creator reports";
  retrievedAt: string | null;
  metrics: CapabilityMetric[];
  models: CapabilityModel[];
}
export type CapabilityComparisons = Record<string, CapabilityComparison>;
