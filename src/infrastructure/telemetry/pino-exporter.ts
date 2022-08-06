import { ExportResultCode, hrTimeToMicroseconds } from "@opentelemetry/core";
import { SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { Logger } from "../logger";

export function createPinoSpanExporter({
  logger,
}: {
  readonly logger: Logger;
}): SpanExporter {
  return {
    export(spans, callback) {
      for (const span of spans) {
        logger.info(span.name, {
          traceId: span.spanContext().traceId,
          parentId: span.parentSpanId,
          name: span.name,
          id: span.spanContext().spanId,
          kind: span.kind,
          timestamp: hrTimeToMicroseconds(span.startTime),
          duration: hrTimeToMicroseconds(span.duration),
          attributes: span.attributes,
          status: span.status,
          events: span.events,
        })();
      }

      callback({
        code: ExportResultCode.SUCCESS,
      });
    },
    async shutdown() {
      logger.flush()();

      // SpanExported requires shutdown to be asynchronous
      await Promise.resolve();

      return;
    },
  };
}
