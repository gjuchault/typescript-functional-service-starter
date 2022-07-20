import * as F from "fp-ts/lib/function";
import { z } from "zod";
import type { HealthcheckApplication } from "../../application/healthcheck";
import type { HttpServer } from "../../infrastructure/http";
import { bindHealthcheckRoutes } from "./routes/healthcheck";

export function bindHttpRoutes({
  httpServer,
  healthcheckApplication,
}: {
  readonly httpServer: HttpServer;
  readonly healthcheckApplication: HealthcheckApplication;
}) {
  return F.pipe(
    httpServer,
    bindDocumentationRoute(),
    bindHealthcheckRoutes({ healthcheckApplication })
  );
}

function bindDocumentationRoute() {
  return function (httpServer: HttpServer) {
    return httpServer.get(
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
  };
}
