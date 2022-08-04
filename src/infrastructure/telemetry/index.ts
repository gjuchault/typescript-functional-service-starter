import type { IncomingMessage, ServerResponse } from "node:http";
import {
  context,
  propagation,
  SpanOptions,
  SpanStatusCode,
  Span,
  Tracer,
  trace,
} from "@opentelemetry/api";
import {
  Counter,
  Histogram,
  Meter,
  MetricOptions,
  metrics as apiMetrics,
  UpDownCounter,
} from "@opentelemetry/api-metrics";
import {
  TraceIdRatioBasedSampler,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  InMemorySpanExporter,
  SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import * as E from "fp-ts/lib/Either";
import * as IO from "fp-ts/lib/IO";
import * as TE from "fp-ts/lib/TaskEither";
import type { Config } from "../../config";
import { createLogger } from "../logger";
import { bindSystemMetrics } from "./metrics/system";
import { createPinoSpanExporter } from "./pino-exporter";

export interface Telemetry {
  readonly getMetricsRequestHandler: (
    _request: IncomingMessage,
    response: ServerResponse
  ) => IO.IO<void>;
  readonly withSpan: <E, A>(
    name: string,
    options: SpanOptions | undefined
  ) => (callback: TE.TaskEither<E, A>) => TE.TaskEither<E, A>;
  readonly startSpan: (name: string, options: SpanOptions) => IO.IO<Span>;
  readonly shutdown: () => TE.TaskEither<Error, void>;
  readonly createHistogram: (
    name: string,
    options: MetricOptions
  ) => IO.IO<Histogram>;
  readonly createCounter: (
    name: string,
    options: MetricOptions
  ) => IO.IO<Counter>;
  readonly createUpDownCounter: (
    name: string,
    options: MetricOptions
  ) => IO.IO<UpDownCounter>;
}

export async function createTelemetry({
  config,
}: {
  config: Config;
}): Promise<Telemetry> {
  const logger = createLogger("telemetry", { config });

  const traceExporter: SpanExporter =
    config.env === "production"
      ? createPinoSpanExporter({ logger })
      : new InMemorySpanExporter();

  const metricReader = new PrometheusExporter({
    preventServerStart: true,
  });

  const sdk = new NodeSDK({
    traceExporter,
    metricReader,
    sampler: new TraceIdRatioBasedSampler(1),
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.name,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.env,
      [SemanticResourceAttributes.PROCESS_PID]: process.pid,
    }),
    autoDetectResources: false,
  });

  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  await sdk.start();

  const tracer = trace.getTracer(config.name, config.version);

  const meter = apiMetrics.getMeter(config.name, config.version);

  bindSystemMetrics({ meter });

  return makeOpentelemetryFunctionalWrapper({
    sdk,
    tracer,
    metricReader,
    meter,
  });
}

function makeOpentelemetryFunctionalWrapper({
  sdk,
  tracer,
  metricReader,
  meter,
}: {
  sdk: NodeSDK;
  tracer: Tracer;
  metricReader: PrometheusExporter;
  meter: Meter;
}): Telemetry {
  return {
    withSpan<E, A>(
      name: string,
      options: SpanOptions | undefined
    ): (callback: TE.TaskEither<E, A>) => TE.TaskEither<E, A> {
      return (callback) => {
        return async function () {
          const span = tracer.startSpan(name, options);
          const traceContext = trace.setSpan(context.active(), span);

          const result = await context.with(traceContext, async () => {
            const innerResult = await callback();

            if (E.isLeft(innerResult)) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: getErrorMessage(innerResult.left),
              });
              span.recordException(E.toError(innerResult.left));
            } else {
              span.setStatus({ code: SpanStatusCode.OK });
            }

            span.end();

            return innerResult;
          });

          return result;
        };
      };
    },
    getMetricsRequestHandler(request: IncomingMessage, result: ServerResponse) {
      return () => {
        return metricReader.getMetricsRequestHandler(request, result);
      };
    },
    startSpan(name: string, options: SpanOptions) {
      return () => {
        const span = tracer.startSpan(name, options);
        return span;
      };
    },
    createHistogram(name: string, options: MetricOptions) {
      return () => meter.createHistogram(name, options);
    },
    createCounter(name: string, options: MetricOptions) {
      return () => meter.createCounter(name, options);
    },
    createUpDownCounter(name: string, options: MetricOptions) {
      return () => meter.createUpDownCounter(name, options);
    },
    shutdown() {
      return TE.tryCatch(() => sdk.shutdown(), E.toError);
    },
  };
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "telemetry: unknown error";
}
