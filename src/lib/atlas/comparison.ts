import type { ModelEntry } from "./models";

/** Planning assumptions are separate from catalog artifacts and measured evidence. */
export interface QuantScenario {
  modelSlug: string;
  variant: string;
  bpw: string;
}

export function positiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function scenarioBpw(value: string): number | null {
  const number = positiveNumber(value);
  return number !== null && number <= 16 ? number : null;
}

/** Decimal GB, uniform packing proxy. MoE weights use TOTAL, not active, parameters. */
export function packedWeightGb(paramsB: number, bpw: number): number | null {
  if (!Number.isFinite(paramsB) || paramsB <= 0 || scenarioBpw(String(bpw)) === null) return null;
  const result = paramsB / 8 * bpw;
  return Number.isFinite(result) && result > 0 ? result : null;
}

export function equalWeightBudgetBpw(paramsB: number, weightGb: number): number | null {
  if (!Number.isFinite(paramsB) || paramsB <= 0 || !Number.isFinite(weightGb) || weightGb <= 0) return null;
  const result = weightGb / paramsB * 8;
  return Number.isFinite(result) && result > 0 ? result : null;
}

export function scenarioFromParams(params: Pick<URLSearchParams, "get">, side: "left" | "right"): QuantScenario {
  return { modelSlug: params.get(side) ?? "", variant: params.get(`${side}Variant`) ?? "", bpw: params.get(`${side}Bpw`) ?? "3" };
}

export function comparisonHref(left: QuantScenario, right: QuantScenario, budget: string): string {
  const params = new URLSearchParams();
  for (const [side, scenario] of [["left", left], ["right", right]] as const) {
    params.set(side, scenario.modelSlug);
    params.set(`${side}Bpw`, scenario.bpw);
    if (scenario.variant) params.set(`${side}Variant`, scenario.variant);
  }
  params.set("budget", budget);
  return `/compare?${params}`;
}

export function glmComparisonHref(entries: ModelEntry[]): string | null {
  const regular = entries.find((entry) => entry.family.id === "glm" && entry.release.id === "glm-5-3");
  const flash = entries.find((entry) => entry.family.id === "glm" && entry.release.id === "glm-5-3-flash");
  if (!regular || !flash) return null;
  return comparisonHref(
    { modelSlug: regular.slug, variant: regular.size.variants[0] ?? "", bpw: "2.75" },
    { modelSlug: flash.slug, variant: flash.size.variants[0] ?? "", bpw: "3" },
    "",
  );
}
