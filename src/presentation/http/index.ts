import * as F from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
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
    return httpServer.createRoute({
      handler(request) {
        return T.of({
          status: 200,
          body: request.server.swagger(),
        });
      },
      method: "GET",
      url: "/docs",
      schema: {
        response: {
          200: z.object({}),
        },
      },
    });
  };
}
