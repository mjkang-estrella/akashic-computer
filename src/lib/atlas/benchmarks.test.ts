import { describe, expect, it } from "vitest";
import { OFFICIAL_BENCHMARKS, resolveOfficialBenchmarks } from "./benchmarks";
import { modelEntry } from "../../../test/catalogFixture";

const benchmarkEntries = [...new Set(
  OFFICIAL_BENCHMARKS.flatMap((benchmark) => benchmark.results.map((result) => result.repo)),
)].map((repo, index) => modelEntry({
  slug: `benchmark-model-${index}`,
  repo,
  releaseName: repo.split("/").at(-1) ?? repo,
}));

describe("official benchmark leaderboards", () => {
  it("uses unique benchmark identifiers", () => {
    const ids = OFFICIAL_BENCHMARKS.map((benchmark) => benchmark.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains no duplicate repository in one benchmark", () => {
    for (const benchmark of OFFICIAL_BENCHMARKS) {
      const repos = benchmark.results.map((result) => result.repo);
      expect(new Set(repos).size, benchmark.name).toBe(repos.length);
    }
  });

  it("resolves every curated result against the catalog snapshot", () => {
    const resolved = resolveOfficialBenchmarks(benchmarkEntries);
    const expected = OFFICIAL_BENCHMARKS.reduce(
      (total, benchmark) => total + benchmark.results.length,
      0,
    );
    const actual = resolved.reduce(
      (total, benchmark) => total + benchmark.results.length,
      0,
    );
    expect(actual).toBe(expected);
  });

  it("sorts higher scores first and assigns stable tie ranks", () => {
    for (const benchmark of resolveOfficialBenchmarks(benchmarkEntries)) {
      expect(benchmark.results.length, benchmark.name).toBeGreaterThanOrEqual(2);
      for (let index = 1; index < benchmark.results.length; index += 1) {
        const previous = benchmark.results[index - 1];
        const current = benchmark.results[index];
        expect(previous.score).toBeGreaterThanOrEqual(current.score);
        if (previous.score === current.score) expect(current.rank).toBe(previous.rank);
      }
    }
  });
});
