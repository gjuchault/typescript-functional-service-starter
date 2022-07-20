import { DatabasePool, sql } from "slonik";

export interface HealthcheckRepository {
  getHealthcheck(): Promise<GetHealthcheckResult>;
}

export type GetHealthcheckResult =
  | { outcome: "healthy" }
  | { outcome: "unhealthy" };

export function createHealthcheckRepository({
  database,
}: {
  database: DatabasePool;
}): HealthcheckRepository {
  async function getHealthcheck(): Promise<GetHealthcheckResult> {
    try {
      await database.query(sql`select 1`);

      return {
        outcome: "healthy",
      };
    } catch {
      return {
        outcome: "unhealthy",
      };
    }
  }

  return { getHealthcheck };
}
