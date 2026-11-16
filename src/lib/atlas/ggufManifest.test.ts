import { expect, it } from "vitest";
import type { ArtifactBuild } from "./artifactBuilds";
import { firstManifestRequest, ggufManifestState, manifestRequestKey, type ManifestPage } from "./ggufManifest";

function build(index: number, revision = "revision-a"): ArtifactBuild {
  return { key: `build-${index}`, repo: "org/model", revision, label: `Q${index}`, files: [], bytes: index + 1, complete: true, container: "gguf", quantization: `Q${index}`, mtp: "absent", baseModels: [], sourceUrl: "" };
}

it("follows all manifest pages and withholds counts/ranges until the last page", () => {
  const repos = ["org/model"];
  const first = firstManifestRequest(repos[0]);
  const results: Record<string, ManifestPage | Error | undefined> = {};
  expect(ggufManifestState(repos, results).requests).toEqual([first]);
  results[manifestRequestKey(first)] = { page: Array.from({ length: 50 }, (_, i) => build(i)), isDone: false, continueCursor: "page-2" };
  const second = ggufManifestState(repos, results);
  expect(second.files).toEqual({});
  expect(second.requests[1]).toMatchObject({ revision: "revision-a", paginationOpts: { cursor: "page-2" } });
  results[manifestRequestKey(second.requests[1])] = { page: Array.from({ length: 50 }, (_, i) => build(i + 50)), isDone: false, continueCursor: "page-3" };
  const third = ggufManifestState(repos, results);
  expect(third.files).toEqual({});
  results[manifestRequestKey(third.requests[2])] = { page: [build(100)], isDone: true, continueCursor: "" };
  const done = ggufManifestState(repos, results);
  expect(done.files[repos[0]]).toHaveLength(101);
  expect(done.files[repos[0]][0].bytes).toBe(101);
  expect(done.files[repos[0]].at(-1)?.bytes).toBe(1);
});

it("restarts at the new revision without mixing old pages and drops removed repos", () => {
  const repo = "org/model";
  const head = firstManifestRequest(repo);
  const old = { repo, revision: "revision-a", paginationOpts: { numItems: 50, cursor: "next" } };
  const results = {
    [manifestRequestKey(head)]: { page: [build(0, "revision-b")], isDone: false, continueCursor: "next" },
    [manifestRequestKey(old)]: { page: [build(1)], isDone: true, continueCursor: "" },
  };
  expect(ggufManifestState([repo], results).files).toEqual({});
  expect(ggufManifestState([repo], results).requests[1].revision).toBe("revision-b");
  expect(ggufManifestState([], results)).toEqual({ requests: [], files: {} });
});

it("does not expose partial files on an error or a repeated cursor, and handles empty manifests", () => {
  const repo = "org/model";
  const first = firstManifestRequest(repo);
  const head = { page: [build(0)], isDone: false, continueCursor: "same" };
  const results: Record<string, ManifestPage | Error> = { [manifestRequestKey(first)]: head };
  const next = ggufManifestState([repo], results).requests[1];
  results[manifestRequestKey(next)] = new Error("failed");
  expect(ggufManifestState([repo], results).files).toEqual({});
  results[manifestRequestKey(next)] = head;
  expect(ggufManifestState([repo], results).files).toEqual({});
  results[manifestRequestKey(first)] = { page: [], isDone: true, continueCursor: "" };
  expect(ggufManifestState([repo], results).files).toEqual({});
});
