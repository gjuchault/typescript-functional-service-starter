import os from "node:os";
import v8 from "node:v8";
import * as A from "fp-ts/lib/Apply";
import * as F from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import type { Cache } from "../../infrastructure/cache";
import type { HealthcheckRepository } from "../../repository/healthcheck";

export interface GetHealthcheckContext {
  readonly healthcheckRepository: HealthcheckRepository;
  readonly cache: Pick<Cache, "echo">;
}

export interface GetHealthcheckResult {
  readonly database: "healthy" | "unhealthy";
  readonly cache: "healthy" | "unhealthy";
  readonly systemMemory: "healthy" | "unhealthy";
  readonly processMemory: "healthy" | "unhealthy";
}

export function getHealthcheck({
  healthcheckRepository,
  cache,
}: GetHealthcheckContext): T.Task<GetHealthcheckResult> {
  const getDatabaseHealthcheck = F.pipe(
    healthcheckRepository.getHealthcheck(),
    T.map((result) => result.outcome)
  );

  const getCacheHealthcheck = F.pipe(
    "1",
    cache.echo,
    TE.fold<Error, string, "healthy" | "unhealthy">(
      () => T.of("unhealthy"),
      () => T.of("healthy")
    )
  );

  const getSystemMemoryHealthcheck = T.of(
    F.pipe(os.freemem() / os.totalmem(), getSystemMetricHealthiness)
  );

  const getProcessMemoryUsage = T.of(
    F.pipe(v8.getHeapStatistics(), getMemoryUsage, getSystemMetricHealthiness)
  );

  return A.sequenceS(T.ApplyPar)({
    database: getDatabaseHealthcheck,
    cache: getCacheHealthcheck,
    systemMemory: getSystemMemoryHealthcheck,
    processMemory: getProcessMemoryUsage,
  });
}

function getSystemMetricHealthiness(value: number): "healthy" | "unhealthy" {
  return value > 0.8 ? "unhealthy" : "healthy";
}

function getMemoryUsage(heapStatistics: Readonly<v8.HeapInfo>) {
  return heapStatistics.total_heap_size / heapStatistics.heap_size_limit;
}
