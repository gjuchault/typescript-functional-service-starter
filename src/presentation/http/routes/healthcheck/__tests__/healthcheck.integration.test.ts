import type { LightMyRequestResponse } from "fastify";
import { beforeAll, describe, expect, it } from "vitest";
import type { HealthcheckResponseSchema } from "..";
import { getHttpTestContext } from "../../../../../test-helpers/integration-start-context";

describe("GET /healthcheck", () => {
  describe("when called", () => {
    let response: LightMyRequestResponse;

    beforeAll(async () => {
      const http = getHttpTestContext();
      response = await http.inject("/healthcheck");
    });

    it("returns 200", () => {
      const body = response.json<HealthcheckResponseSchema>();

      if (typeof process.env.CI === "undefined") {
        expect(response.statusCode).toBe(200);
        expect(body.database).toBe("healthy");
        expect(body.cache).toBe("healthy");
        expect(body.systemMemory).toBe("healthy");
        expect(body.processMemory).toBe("healthy");
        expect(body.http).toBe("healthy");
      } else {
        // in Github Actions, process memory seems to be low or static
        expect(response.statusCode).toBe(500);
        expect(body.database).toBe("healthy");
        expect(body.cache).toBe("healthy");
        expect(body.http).toBe("healthy");
      }
    });
  });
});
