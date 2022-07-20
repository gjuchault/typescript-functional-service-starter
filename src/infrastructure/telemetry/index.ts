import {
  context,
  propagation,
  Span,
  SpanOptions,
  SpanStatusCode,
  Tracer,
  trace,
} from "@opentelemetry/api";
import { Meter, metrics as apiMetrics } from "@opentelemetry/api-metrics";
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
import type { Config } from "../../config";
import { bindSystemMetrics } from "./metrics/system";
import { pinoSpanExporter } from "./pino-exporter";

export interface Telemetry {
  metrics: Meter;
  metricReader: PrometheusExporter;
  tracer: Tracer;
  startSpan<TResolved>(
    name: string,
    options: SpanOptions | undefined,
    callback: StartSpanCallback<TResolved>
  ): Promise<TResolved>;
  shutdown(): Promise<void>;
}

type StartSpanCallback<TResolved> = (
  span: Span
) => Promise<TResolved> | TResolved;

export async function createTelemetry({
  config,
}: {
  config: Config;
}): Promise<Telemetry> {
  const traceExporter: SpanExporter =
    config.env === "production" ? pinoSpanExporter : new InMemorySpanExporter();

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

  const metrics = apiMetrics.getMeter(config.name, config.version);

  bindSystemMetrics({ metrics });

  async function startSpan<TResolved>(
    name: string,
    options: SpanOptions | undefined,
    callback: StartSpanCallback<TResolved>
  ): Promise<TResolved> {
    const span = tracer.startSpan(name, options);
    const traceContext = trace.setSpan(context.active(), span);

    return context.with(traceContext, async () => {
      try {
        const result: TResolved = await callback(span);

        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error);
        }

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: getErrorMessage(error),
        });

        throw error;
      } finally {
        span.end();
      }
    });
  }

  async function shutdown() {
    await sdk.shutdown();
  }

  return {
    metrics,
    metricReader,
    tracer,
    startSpan,
    shutdown,
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
