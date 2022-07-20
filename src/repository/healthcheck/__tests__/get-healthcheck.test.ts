import { createMockPool, createMockQueryResult, sql } from "slonik";
import { beforeAll, describe, it, vi, expect } from "vitest";
import { createHealthcheckRepository, GetHealthcheckResult } from "..";

describe("getHealthcheck()", () => {
  describe("given a healthy database", () => {
    const database = createMockPool({
      query() {
        return Promise.resolve(createMockQueryResult([]));
      },
    });

    const repository = createHealthcheckRepository({
      database,
    });

    const spyQuery = vi.spyOn(database, "query");

    describe("when called", () => {
      let result: GetHealthcheckResult;

      beforeAll(async () => {
        result = await repository.getHealthcheck();
      });

      it("returns outcome healthy", () => {
        expect(result.outcome).toBe("healthy");
      });

      it("called the database with the appropriate query", () => {
        expect(spyQuery).toBeCalledTimes(1);
        expect(spyQuery.mock.calls[0][0]).toEqual(sql`select 1`);
      });
    });
  });

  describe("given an unhealthy database", () => {
    const database = createMockPool({
      query() {
        throw new Error("error");
      },
    });

    const repository = createHealthcheckRepository({
      database,
    });

    const spyQuery = vi.spyOn(database, "query");

    describe("when called", () => {
      let result: GetHealthcheckResult;

      beforeAll(async () => {
        result = await repository.getHealthcheck();
      });

      it("returns outcome unhealthy", () => {
        expect(result.outcome).toBe("unhealthy");
      });

      it("called the database with the appropriate query", () => {
        expect(spyQuery).toBeCalledTimes(1);
        expect(spyQuery.mock.calls[0][0]).toEqual(sql`select 1`);
      });
    });
  });
});
