import type { Database } from "../infrastructure/database";
import { createHealthcheckRepository } from "./healthcheck";

export function createRepository({
  database,
}: {
  readonly database: Database;
}) {
  return {
    healthcheck: createHealthcheckRepository({
      database,
    }),
  };
}
