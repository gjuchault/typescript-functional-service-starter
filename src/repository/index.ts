import type { Database } from "../infrastructure/database";
import { createHealthcheckRepository } from "./healthcheck";

export function createRepository({ database }: { database: Database }) {
  return {
    healthcheck: createHealthcheckRepository({
      database,
    }),
  };
}
