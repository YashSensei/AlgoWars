import { describe, expect, it } from "bun:test";
import { app } from "./app";

describe("Health Check", () => {
  it("GET /health returns ok", async () => {
    const res = await app.request("/health");
    const json = (await res.json()) as { status: string; timestamp: number };

    expect(res.status).toBe(200);
    expect(json.status).toBe("ok");
    expect(json.timestamp).toBeDefined();
  });
});
