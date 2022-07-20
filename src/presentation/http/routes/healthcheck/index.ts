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
  httpServer,
  healthcheckApplication,
}: {
  httpServer: HttpServer;
  healthcheckApplication: HealthcheckApplication;
}) {
  httpServer.get(
    "/healthcheck",
    {
      schema: {
        description: "Check the status of the application",
        response: {
          200: healthcheckResponseSchema,
          500: healthcheckResponseSchema,
        },
      },
    },
    async function handler(_request, reply) {
      const healthcheck = await healthcheckApplication.getHealthcheck();

      let status = 200;
      for (const value of Object.values(healthcheck)) {
        if (value !== "healthy") {
          status = 500;
          break;
        }
      }

      return reply.code(status).send({
        ...healthcheck,
        http: "healthy",
      });
    }
  );
}
