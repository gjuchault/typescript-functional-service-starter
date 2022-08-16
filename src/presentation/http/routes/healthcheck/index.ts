import { pipe } from "fp-ts/function";
import * as RT from "fp-ts/ReaderTask";
import * as R from "fp-ts/Record";
import * as S from "fp-ts/string";
import * as T from "fp-ts/Task";
import { z } from "zod";
import {
  getHealthcheck,
  GetHealthcheckResult,
} from "../../../../application/healthcheck/get-healthcheck";
import type { Cache } from "../../../../infrastructure/cache";
import type { Database } from "../../../../infrastructure/database";
import type { HttpServer } from "../../../../infrastructure/http";
import { getHealthcheckRepository } from "../../../../repository/healthcheck";

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

interface Dependencies {
  readonly httpServer: HttpServer;
  readonly database: Database;
  readonly cache: Cache;
}

export const bindHealthcheckRoutes = (): RT.ReaderTask<
  Dependencies,
  HttpServer
> =>
  pipe(
    RT.ask<Dependencies>(),
    RT.map(({ httpServer, database, cache }) =>
      httpServer.createRoute({
        method: "GET",
        url: "/healthcheck",
        schema: {
          description: "Check the status of the application",
          response: {
            200: healthcheckResponseSchema,
            500: healthcheckResponseSchema,
          },
        },
        handler: () =>
          pipe(
            { database, cache },
            getHealthcheckRepository(),
            (repository) => ({
              repository,
              cache,
            }),
            getHealthcheck(),
            T.map((healthcheckResult) => ({
              status: computeStatus(healthcheckResult),
              body: {
                ...healthcheckResult,
                http: "healthy",
              },
            }))
          ),
      })
    )
  );

export function computeStatus(healthcheckResult: GetHealthcheckResult): number {
  return pipe(
    { ...healthcheckResult },
    // eslint-disable-next-line unicorn/no-array-reduce, unicorn/no-array-callback-reference
    R.reduce(S.Ord)(200, (accumulator, statusEntry) =>
      statusEntry !== "healthy" || accumulator === 500 ? 500 : accumulator
    )
  );
}
