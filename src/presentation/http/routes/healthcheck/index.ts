import { pipe } from "fp-ts/lib/function";
import * as RT from "fp-ts/lib/ReaderTask";
import * as R from "fp-ts/lib/Record";
import * as S from "fp-ts/lib/string";
import * as T from "fp-ts/lib/Task";
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
    RT.chain(({ httpServer, database, cache }) =>
      RT.of(
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
              T.chain((healthcheckResult) =>
                T.of({
                  status: computeStatus(healthcheckResult),
                  body: {
                    ...healthcheckResult,
                    http: "healthy",
                  },
                })
              )
            ),
        })
      )
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
