import { describe, it, expect } from "vitest";
import type { GetHealthcheckResult } from "../../../../../application/healthcheck/get-healthcheck";
import { computeStatus } from "../index";

describe("computeStatus()", () => {
  describe("given a fully healthy result", () => {
    const healthcheckResult: GetHealthcheckResult = {
      database: "healthy",
      cache: "healthy",
      systemMemory: "healthy",
      processMemory: "healthy",
    };

    describe("when called", () => {
      it("returns 200", () => {
        expect(computeStatus(healthcheckResult)).toBe(200);
      });
    });
  });

  describe("given a partially unhealthy result", () => {
    const healthcheckResult: GetHealthcheckResult = {
      database: "healthy",
      cache: "unhealthy",
      systemMemory: "healthy",
      processMemory: "healthy",
    };

    describe("when called", () => {
      it("returns 200", () => {
        expect(computeStatus(healthcheckResult)).toBe(500);
      });
    });
  });
});
