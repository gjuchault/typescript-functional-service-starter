import { describe, it, vi, expect } from "vitest";
import { getComputeStatus } from "../index";

describe("computeStatus", () => {
  describe("given a fully healthy result", () => {
    const getHealthcheck = vi.fn().mockResolvedValue({
      database: "healthy",
      cache: "healthy",
      systemMemory: "healthy",
      processMemory: "healthy",
    });

    describe("when called", () => {
      it("returns 200", async () => {
        expect(await getComputeStatus({ getHealthcheck })()).toBe(200);
      });
    });
  });

  describe("given a partially unhealthy result", () => {
    const getHealthcheck = vi.fn().mockResolvedValue({
      database: "healthy",
      cache: "unhealthy",
      systemMemory: "healthy",
      processMemory: "healthy",
    });

    describe("when called", () => {
      it("returns 200", async () => {
        expect(await getComputeStatus({ getHealthcheck })()).toBe(500);
      });
    });
  });
});
