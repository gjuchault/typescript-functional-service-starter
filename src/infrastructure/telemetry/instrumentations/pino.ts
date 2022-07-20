import { context, trace } from "@opentelemetry/api";

export function pinoMixin(data: object) {
  const span = trace.getSpan(context.active());

  if (!span) {
    return {};
  }

  const spanContext = span.spanContext();

  const recordData = data as Record<string, unknown>;

  const record = {
    traceId: recordData.traceId ?? spanContext.traceId,
    spanId: recordData.spanId ?? spanContext.spanId,
    traceFlags:
      recordData.traceFlags ?? `0${spanContext.traceFlags.toString(16)}`,
  };

  return record;
}
