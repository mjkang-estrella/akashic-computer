import { describe, expect, it } from "vitest";
import { docArticleBySlug } from "./docsArticles";
import { filterStudyResources, parseReadResources, STUDY_INVESTIGATIONS, STUDY_PATHS, STUDY_RESOURCES, studyPath, studyResource } from "./study";

describe("study curriculum", () => {
  it("keeps paths navigable with resolvable, unique steps and companion guides", () => {
    expect(new Set(STUDY_PATHS.map((path) => path.slug)).size).toBe(STUDY_PATHS.length);
    expect(new Set(STUDY_RESOURCES.map((resource) => resource.id)).size).toBe(STUDY_RESOURCES.length);
    const used = new Set<string>();
    for (const path of STUDY_PATHS) {
      expect(new Set(path.steps.map((step) => step.resourceId)).size).toBe(path.steps.length);
      for (const step of path.steps) { expect(studyResource(step.resourceId)).toBeDefined(); used.add(step.resourceId); }
      for (const guide of path.guides) expect(docArticleBySlug(guide)).toBeDefined();
      for (const prerequisite of path.prerequisites) expect(studyPath(prerequisite)).toBeDefined();
    }
    expect(used.size).toBe(STUDY_RESOURCES.length);
    for (const investigation of STUDY_INVESTIGATIONS) expect(studyPath(investigation.pathSlug)).toBeDefined();
  });
  it("does not introduce a prerequisite cycle that prevents starting a path", () => {
    function visit(slug: string, ancestors: Set<string>) {
      expect(ancestors.has(slug), `cycle at ${slug}`).toBe(false);
      for (const prerequisite of studyPath(slug)!.prerequisites) visit(prerequisite, new Set([...ancestors, slug]));
    }
    for (const path of STUDY_PATHS) visit(path.slug, new Set());
  });
  it("combines search terms and metadata filters, including explicit unread progress", () => {
    const filters = { query: "  EXL3 calibration ", topic: "Quantization", kind: "Documentation", level: "Intermediate" };
    expect(filterStudyResources(STUDY_RESOURCES, filters).map((resource) => resource.id)).toEqual(["exl3-conversion"]);
    expect(filterStudyResources(STUDY_RESOURCES, { ...filters, unreadOnly: true }, new Set(["exl3-conversion"]))).toEqual([]);
    expect(filterStudyResources(STUDY_RESOURCES, { ...filters, topic: "Profiling" })).toEqual([]);
    expect(filterStudyResources(STUDY_RESOURCES, { query: "AMD", topic: "", kind: "", level: "" }).map((resource) => resource.id)).toEqual(["rocm-profiler"]);
  });
  it("ignores corrupted, retired and non-string progress instead of trusting browser data", () => {
    expect([...parseReadResources('["exl3-conversion","removed",null,{},"exl3-conversion"]')]).toEqual(["exl3-conversion"]);
    for (const raw of ["not JSON", "null", "{}", "42"]) expect(parseReadResources(raw).size).toBe(0);
  });
});
