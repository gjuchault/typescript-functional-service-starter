import type { Redis } from "ioredis";
import { beforeAll, describe, it, vi, expect } from "vitest";
import type { HealthcheckRepository } from "../../../repository/healthcheck";
import { getHealthcheck, GetHealthcheckResult } from "../get-healthcheck";

const mockHealthyCache = {
  echo: vi.fn().mockResolvedValue("1"),
} as unknown as Redis;

const mockUnhealthyCache = {
  echo: vi.fn().mockRejectedValue(new Error("error")),
} as unknown as Redis;

const mockHealthyRepository: HealthcheckRepository = {
  getHealthcheck: vi.fn().mockResolvedValue({ outcome: "healthy" }),
};

const mockUnhealthyRepository: HealthcheckRepository = {
  getHealthcheck: vi.fn().mockResolvedValue({ outcome: "unhealthy" }),
};

describe("getHealthcheck()", () => {
  describe("given a healthy cache and database", () => {
    describe("when called", () => {
      let result: GetHealthcheckResult;

      beforeAll(async () => {
        result = await getHealthcheck({
          cache: mockHealthyCache,
          healthcheckRepository: mockHealthyRepository,
        });
      });

      it("returns healthy", () => {
        expect(result.cache).toBe("healthy");
        expect(result.database).toBe("healthy");

        // in Github Actions, process memory seems to be low or static
        if (typeof process.env.CI === "undefined") {
          expect(result.systemMemory).toBe("healthy");
          expect(result.processMemory).toBe("healthy");
        }
      });
    });
  });

  describe("given an unhealthy cache and healthy database", () => {
    describe("when called", () => {
      let result: GetHealthcheckResult;

      beforeAll(async () => {
        result = await getHealthcheck({
          cache: mockUnhealthyCache,
          healthcheckRepository: mockHealthyRepository,
        });
      });

      it("returns unhealthy cache, healthy database", () => {
        expect(result.cache).toBe("unhealthy");
        expect(result.database).toBe("healthy");

        // in Github Actions, process memory seems to be low or static
        if (typeof process.env.CI === "undefined") {
          expect(result.systemMemory).toBe("healthy");
          expect(result.processMemory).toBe("healthy");
        }
      });
    });
  });

  describe("given a healthy cache and unhealthy database", () => {
    describe("when called", () => {
      let result: GetHealthcheckResult;

      beforeAll(async () => {
        result = await getHealthcheck({
          cache: mockHealthyCache,
          healthcheckRepository: mockUnhealthyRepository,
        });
      });

      it("returns unhealthy cache, healthy database", () => {
        expect(result.cache).toBe("healthy");
        expect(result.database).toBe("unhealthy");

        // in Github Actions, process memory seems to be low or static
        if (typeof process.env.CI === "undefined") {
          expect(result.systemMemory).toBe("healthy");
          expect(result.processMemory).toBe("healthy");
        }
      });
    });
  });

  describe("given a healthy cache and database", () => {
    describe("when called", () => {
      let result: GetHealthcheckResult;

      beforeAll(async () => {
        result = await getHealthcheck({
          cache: mockUnhealthyCache,
          healthcheckRepository: mockUnhealthyRepository,
        });
      });

      it("returns unhealthy cache, healthy database", () => {
        expect(result.cache).toBe("unhealthy");
        expect(result.database).toBe("unhealthy");

        // in Github Actions, process memory seems to be low or static
        if (typeof process.env.CI === "undefined") {
          expect(result.systemMemory).toBe("healthy");
          expect(result.processMemory).toBe("healthy");
        }
      });
    });
  });
});
