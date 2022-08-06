import os from "node:os";
import v8 from "node:v8";
import * as Apply from "fp-ts/Apply";
import { pipe } from "fp-ts/function";
import * as RT from "fp-ts/ReaderTask";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import type { Cache } from "../../infrastructure/cache";
import type { HealthcheckRepository } from "../../repository/healthcheck";

interface Dependencies {
  readonly repository: Pick<HealthcheckRepository, "getHealthcheck">;
  readonly cache: Pick<Cache, "echo">;
}

export interface GetHealthcheckResult {
  readonly database: "healthy" | "unhealthy";
  readonly cache: "healthy" | "unhealthy";
  readonly systemMemory: "healthy" | "unhealthy";
  readonly processMemory: "healthy" | "unhealthy";
}

export const getHealthcheck = (): RT.ReaderTask<
  Dependencies,
  GetHealthcheckResult
> =>
  pipe(
    RT.ask<Dependencies>(),
    RT.chain(({ repository, cache }) => {
      const getDatabaseHealthcheck = pipe(
        repository.getHealthcheck(),
        T.map(({ outcome }) => outcome)
      );

      const getCacheHealthcheck = pipe(
        "1",
        cache.echo,
        TE.fold<Error, string, "healthy" | "unhealthy">(
          () => T.of("unhealthy"),
          () => T.of("healthy")
        )
      );

      const getSystemMemoryHealthcheck = T.of(
        pipe(os.freemem() / os.totalmem(), getSystemMetricHealthiness)
      );

      const getProcessMemoryUsage = T.of(
        pipe(v8.getHeapStatistics(), getMemoryUsage, getSystemMetricHealthiness)
      );

      return RT.fromTask(
        Apply.sequenceS(T.ApplyPar)({
          database: getDatabaseHealthcheck,
          cache: getCacheHealthcheck,
          systemMemory: getSystemMemoryHealthcheck,
          processMemory: getProcessMemoryUsage,
        })
      );
    })
  );

function getSystemMetricHealthiness(value: number): "healthy" | "unhealthy" {
  return value > 0.8 ? "unhealthy" : "healthy";
}

function getMemoryUsage(heapStatistics: Readonly<v8.HeapInfo>) {
  return heapStatistics.total_heap_size / heapStatistics.heap_size_limit;
}
