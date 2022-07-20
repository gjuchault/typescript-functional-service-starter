import { ValueType } from "@opentelemetry/api-metrics";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { Telemetry } from "..";

const ignoredPaths = new Set<string>();

export const metricsPlugin = fp(innerMetricsPlugin);

function innerMetricsPlugin(
  httpServer: FastifyInstance,
  options: Telemetry,
  done: () => void
) {
  const { metrics, metricReader } = options;

  httpServer.get("/metrics", (request, reply) => {
    metricReader.getMetricsRequestHandler(request.raw, reply.raw);
  });

  const httpRequestDurationMicroseconds = metrics.createHistogram(
    "http_request_duration_seconds",
    {
      description: "Duration of HTTP requests in microseconds",
      unit: "milliseconds",
      valueType: ValueType.DOUBLE,
    }
  );

  const durationMap = new WeakMap<FastifyRequest, number>();

  httpServer.addHook("onRequest", (request, _reply, done) => {
    if (request.method === "head" || ignoredPaths.has(request.routerPath)) {
      return done();
    }

    durationMap.set(request, Date.now());
    done();
  });

  httpServer.addHook("onResponse", (request, _reply, done) => {
    const requestStarted = durationMap.get(request);

    if (requestStarted === undefined) {
      return done();
    }

    httpRequestDurationMicroseconds.record(
      (Date.now() - requestStarted) / 1000,
      {
        httpMethod: request.method,
        httpRoute: request.routerPath,
      }
    );

    done();
  });

  done();
}
