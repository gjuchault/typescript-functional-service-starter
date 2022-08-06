import { createMockQueryResult } from "slonik";
import { beforeAll, describe, it, vi, expect } from "vitest";
import { createMockDatabase } from "../../../test-helpers/mock-database";
import { getHealthcheck, GetHealthcheckResult } from "../get-healthcheck";

describe("getHealthcheck()", () => {
  describe("given a healthy database", () => {
    const query = vi.fn().mockResolvedValue(createMockQueryResult([]));

    const database = createMockDatabase({
      query,
    });

    describe("when called", () => {
      let result: GetHealthcheckResult;

      beforeAll(async () => {
        result = await getHealthcheck()({ database })();
      });

      it("returns outcome healthy", () => {
        expect(result.outcome).toBe("healthy");
      });

      it("called the database with the appropriate query", () => {
        expect(query).toBeCalledTimes(1);
        expect(query.mock.calls[0][0]).toEqual("select 1");
      });
    });
  });

  describe("given an unhealthy database", () => {
    const query = vi.fn().mockImplementation(() => {
      throw new Error("error");
    });

    const database = createMockDatabase({
      query,
    });
    describe("when called", () => {
      let result: GetHealthcheckResult;

      beforeAll(async () => {
        result = await getHealthcheck()({ database })();
      });

      it("returns outcome unhealthy", () => {
        expect(result.outcome).toBe("unhealthy");
      });

      it("called the database with the appropriate query", () => {
        expect(query).toBeCalledTimes(1);
        expect(query.mock.calls[0][0]).toEqual("select 1");
      });
    });
  });
});
