import * as A from "fp-ts/lib/Apply";
import * as F from "fp-ts/lib/function";
import * as R from "fp-ts/lib/Record";
import * as S from "fp-ts/lib/string";
import * as T from "fp-ts/lib/Task";
import { z } from "zod";
import type { HealthcheckApplication } from "../../../../application/healthcheck";
import type { HttpServer } from "../../../../infrastructure/http";

const healthcheckResponseSchema = z.object({
  http: z.literal("healthy"),
  database: z.union([z.literal("healthy"), z.literal("unhealthy")]),
  cache: z.union([z.literal("healthy"), z.literal("unhealthy")]),
  systemMemory: z.union([z.literal("healthy"), z.literal("unhealthy")]),
  processMemory: z.union([z.literal("healthy"), z.literal("unhealthy")]),
});

export type HealthcheckResponseSchema = z.infer<
  typeof healthcheckResponseSchema
>;

export function bindHealthcheckRoutes({
  healthcheckApplication,
}: {
  readonly healthcheckApplication: HealthcheckApplication;
}) {
  return function (httpServer: HttpServer) {
    return httpServer.createRoute({
      method: "GET",
      url: "/healthcheck",
      schema: {
        description: "Check the status of the application",
        response: {
          200: healthcheckResponseSchema,
          500: healthcheckResponseSchema,
        },
      },
      handler() {
        const getHealthcheck = healthcheckApplication.getHealthcheck();

        const getStatus = F.pipe(
          getHealthcheck,
          T.map((healthcheck) => {
            return F.pipe(
              { ...healthcheck },
              // eslint-disable-next-line unicorn/no-array-reduce, unicorn/no-array-callback-reference
              R.reduce(S.Ord)(200, (accumulator, statusEntry) =>
                statusEntry !== "healthy" || accumulator === 500
                  ? 500
                  : accumulator
              )
            );
          })
        );

        return A.sequenceS(T.ApplyPar)({
          status: getStatus,
          body: F.pipe(
            getHealthcheck,
            T.map((healthcheck) => ({ ...healthcheck, http: "healthy" }))
          ),
        });
      },
    });
  };
}
