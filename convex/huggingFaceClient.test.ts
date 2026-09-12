import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchRepo,
  hubPaginationUrl,
  listReposPage,
  retryDelayForError,
} from "./huggingFaceClient";

afterEach(() => vi.unstubAllGlobals());

describe("Hub transport", () => {
  it("uses immutable resolved configs and falls back to structured Hub metadata for malformed JSON", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ sha: "commit", config: { model_type: "known" } }),
      )
      .mockResolvedValueOnce(new Response('{ trailing: "comma", }'));
    vi.stubGlobal("fetch", fetch);
    expect((await fetchRepo("creator/model")).data).toEqual({
      sha: "commit",
      config: { model_type: "known" },
    });
    expect(fetch.mock.calls[1][0]).toBe(
      "https://huggingface.co/creator/model/resolve/commit/config.json",
    );
  });

  it("keeps missing config optional and propagates transient config failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ sha: "commit" }))
        .mockResolvedValueOnce(new Response("", { status: 404 })),
    );
    expect((await fetchRepo("creator/model")).data).toEqual({ sha: "commit" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ sha: "commit" }))
        .mockResolvedValueOnce(
          new Response("", {
            status: 429,
            headers: { RateLimit: '"api";r=0;t=420' },
          }),
        ),
    );
    try {
      await fetchRepo("creator/model");
      throw new Error("Expected a rate-limit error");
    } catch (error) {
      expect(retryDelayForError(error, 2, 30_000)).toBe(420_000);
    }
  });

  it("reads one page and follows relative links without changing owner", async () => {
    const link = "/api/models?author=creator&limit=100&cursor=next";
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json([{ id: "creator/model", sha: "commit" }], {
          headers: { link: `<${link}>; rel="next"` },
        }),
      )
      .mockResolvedValueOnce(Response.json([]));
    vi.stubGlobal("fetch", fetch);
    const page = await listReposPage("creator");
    expect(page.repositories).toEqual([{ id: "creator/model", sha: "commit" }]);
    expect(page.nextCursor).toBe(`https://huggingface.co${link}`);
    await listReposPage("creator", page.nextCursor);
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const call of fetch.mock.calls) {
      expect(new URL(call[0]).searchParams.get("expand")).toBe("sha");
    }
    await expect(listReposPage("different", page.nextCursor)).rejects.toThrow(
      "changed source owner",
    );
  });

  it("rejects untrusted pagination before sending authentication headers", () => {
    for (const url of [
      "https://attacker.test/api/models",
      "http://huggingface.co/api/models",
      "https://user:pass@huggingface.co/api/models",
      "/settings/tokens",
    ]) {
      expect(() => hubPaginationUrl(url)).toThrow("Untrusted");
    }
  });
});
