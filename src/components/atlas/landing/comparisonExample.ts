import { glmComparisonHref, packedWeightGb } from "@/lib/atlas/comparison";
import type { ModelEntry } from "@/lib/atlas/models";

/** Keep the landing-page examples tied to the same live preset as the planner. */
export function comparisonExample(entries: ModelEntry[]) {
  const href = glmComparisonHref(entries);
  const params = href ? new URLSearchParams(href.split("?")[1]) : null;
  const scenarios = (["left", "right"] as const).flatMap((side) => {
    const model = entries.find((entry) => entry.slug === params?.get(side));
    const bpw = Number(params?.get(`${side}Bpw`));
    const weights = model ? packedWeightGb(model.size.paramsB, bpw) : null;
    return model && weights !== null ? [{ model, bpw, weights }] : [];
  });
  return { href, scenarios, maxWeights: Math.max(0, ...scenarios.map((scenario) => scenario.weights)) };
}
