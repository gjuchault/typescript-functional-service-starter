import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { beforeAll, describe, it, vi, expect } from "vitest";
import type { Cache } from "../../../infrastructure/cache";
import type { HealthcheckRepository } from "../../../repository/healthcheck";
import { getHealthcheck, GetHealthcheckResult } from "../get-healthcheck";

const mockHealthyCache: Pick<Cache, "echo"> = {
  echo: vi.fn().mockImplementation((input: string) => TE.right(input)),
};

const mockUnhealthyCache: Pick<Cache, "echo"> = {
  echo: vi.fn().mockImplementation(() => TE.left(new Error("error"))),
};

const mockHealthyRepository: HealthcheckRepository = {
  getHealthcheck: vi
    .fn()
    .mockImplementation(() => T.of({ outcome: "healthy" })),
};

const mockUnhealthyRepository: HealthcheckRepository = {
  getHealthcheck: vi
    .fn()
    .mockImplementation(() => T.of({ outcome: "unhealthy" })),
};

describe("getHealthcheck()", () => {
  describe("given a healthy cache and database", () => {
    describe("when called", () => {
      let result: GetHealthcheckResult;

      beforeAll(async () => {
        result = await getHealthcheck()({
          cache: mockHealthyCache,
          repository: mockHealthyRepository,
        })();
      });

      it("returns healthy", () => {
        expect(result.cache).toBe("healthy");
        expect(result.database).toBe("healthy");

        // in Github Actions, process memory seems to be low or static
        if (process.env.CI === undefined) {
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
        result = await getHealthcheck()({
          cache: mockUnhealthyCache,
          repository: mockHealthyRepository,
        })();
      });

      it("returns unhealthy cache, healthy database", () => {
        expect(result.cache).toBe("unhealthy");
        expect(result.database).toBe("healthy");

        // in Github Actions, process memory seems to be low or static
        if (process.env.CI === undefined) {
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
        result = await getHealthcheck()({
          cache: mockHealthyCache,
          repository: mockUnhealthyRepository,
        })();
      });

      it("returns unhealthy cache, healthy database", () => {
        expect(result.cache).toBe("healthy");
        expect(result.database).toBe("unhealthy");

        // in Github Actions, process memory seems to be low or static
        if (process.env.CI === undefined) {
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
        result = await getHealthcheck()({
          cache: mockUnhealthyCache,
          repository: mockUnhealthyRepository,
        })();
      });

      it("returns unhealthy cache, healthy database", () => {
        expect(result.cache).toBe("unhealthy");
        expect(result.database).toBe("unhealthy");

        // in Github Actions, process memory seems to be low or static
        if (process.env.CI === undefined) {
          expect(result.systemMemory).toBe("healthy");
          expect(result.processMemory).toBe("healthy");
        }
      });
    });
  });
});
