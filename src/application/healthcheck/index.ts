import * as T from "fp-ts/lib/Task";
import { Cache } from "../../infrastructure/cache";
import type { HealthcheckRepository } from "../../repository/healthcheck";
import { getHealthcheck, GetHealthcheckResult } from "./get-healthcheck";

export interface HealthcheckApplicationContext {
  readonly healthcheckRepository: HealthcheckRepository;
  readonly cache: Cache;
}

export interface HealthcheckApplication {
  readonly getHealthcheck: () => T.Task<GetHealthcheckResult>;
}

export function createHealthcheckApplication({
  healthcheckRepository,
  cache,
}: HealthcheckApplicationContext): HealthcheckApplication {
  return {
    getHealthcheck() {
      return getHealthcheck({
        cache,
        healthcheckRepository,
      });
    },
  };
}
