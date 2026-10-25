import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag }));

import { POST } from "./route";

function request(body: unknown, token?: string): Request {
  return new Request("https://akashic.computer/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/revalidate", () => {
  beforeEach(() => vi.stubEnv("CATALOG_REVALIDATE_SECRET", "shared-secret"));
  afterEach(() => {
    vi.unstubAllEnvs();
    revalidateTag.mockClear();
  });

  it("rejects requests without the shared secret", async () => {
    expect((await POST(request({ tags: ["catalog:list"] }))).status).toBe(401);
    expect((await POST(request({ tags: ["catalog:list"] }, "wrong"))).status).toBe(401);
    expect((await POST(request({ tags: ["catalog:list"] }, "shared-secret-but-longer"))).status).toBe(401);
    vi.stubEnv("CATALOG_REVALIDATE_SECRET", "");
    expect((await POST(request({ tags: ["catalog:list"] }, ""))).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("accepts only catalog tags", async () => {
    for (const body of [
      "not json",
      { tags: [] },
      { tags: "catalog" },
      { tags: ["_N_T_/layout"] },
      { tags: ["catalog:model:../secrets"] },
      { tags: Array.from({ length: 201 }, () => "catalog") },
    ]) {
      expect((await POST(request(body, "shared-secret"))).status).toBe(400);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("marks each tag stale once", async () => {
    const response = await POST(request({
      tags: ["catalog:list", "catalog:model:qwen-qwen3-8b", "catalog:list"],
    }, "shared-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: 2 });
    expect(revalidateTag.mock.calls).toEqual([
      ["catalog:list", "max"],
      ["catalog:model:qwen-qwen3-8b", "max"],
    ]);
  });
});
