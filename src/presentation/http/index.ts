import { z } from "zod";
import type { HealthcheckApplication } from "../../application/healthcheck";
import type { HttpServer } from "../../infrastructure/http";
import { bindHealthcheckRoutes } from "./routes/healthcheck";

export function bindHttpRoutes({
  httpServer,
  healthcheckApplication,
}: {
  httpServer: HttpServer;
  healthcheckApplication: HealthcheckApplication;
}) {
  httpServer.get(
    "/docs",
    {
      schema: {
        response: {
          200: z.object({}),
        },
      },
    },
    () => {
      return httpServer.swagger();
    }
  );

  bindHealthcheckRoutes({ httpServer, healthcheckApplication });
}
