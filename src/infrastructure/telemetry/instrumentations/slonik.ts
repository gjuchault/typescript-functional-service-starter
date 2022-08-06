import { SpanKind, Span } from "@opentelemetry/api";
import {
  DbSystemValues,
  SemanticAttributes,
} from "@opentelemetry/semantic-conventions";
import { Interceptor, DatabasePool, QueryContext } from "slonik";
import type { Telemetry } from "..";
import { getConfig } from "../../../config";

export const PG_VALUES = "db.postgresql.values";
export const IDLE_TIMEOUT_MILLIS = "db.postgresql.idle.timeout.millis";
export const MAX_CLIENT = "db.postgresql.max.client";

export function getSpanOptions({ pool }: { readonly pool: DatabasePool }) {
  return {
    kind: SpanKind.CLIENT,
    attributes: {
      ...getCommonSpanOptions(),
      ["db.postgresql.idle.timeout.millis"]: pool.configuration.idleTimeout,
      ["db.postgresql.max.client"]: pool.configuration.maximumPoolSize,
    },
  };
}

export function createSlonikTelemetryInterceptor({
  telemetry,
}: {
  readonly telemetry: Telemetry;
}): Interceptor {
  const spanByQueryId = new Map<string, Span>();

  return {
    beforeQueryExecution(queryContext, query) {
      const span = telemetry.startSpan("database.query", {
        kind: SpanKind.CLIENT,
        attributes: {
          ...getCommonSpanOptions(),
          [SemanticAttributes.DB_OPERATION]: getQueryOperationName(query.sql),
          [SemanticAttributes.DB_STATEMENT]: query.sql,
          [PG_VALUES]: query.values.toString(),
        },
      })();

      spanByQueryId.set(getQueryId(queryContext), span);

      // eslint-disable-next-line unicorn/no-null
      return null;
    },
    afterQueryExecution(queryContext) {
      const span = spanByQueryId.get(getQueryId(queryContext));

      if (!span) {
        // eslint-disable-next-line unicorn/no-null
        return null;
      }

      span.end();

      // eslint-disable-next-line unicorn/no-null
      return null;
    },
  };
}

export function getCommonSpanOptions() {
  const config = getConfig();
  const databaseUrl = new URL(config.databaseUrl);
  databaseUrl.password = "";

  return {
    [SemanticAttributes.DB_SYSTEM]: DbSystemValues.POSTGRESQL,
    [SemanticAttributes.DB_NAME]: databaseUrl.pathname.slice(1),
    [SemanticAttributes.NET_PEER_NAME]: databaseUrl.hostname,
    [SemanticAttributes.NET_PEER_PORT]: databaseUrl.port,
    [SemanticAttributes.DB_CONNECTION_STRING]: databaseUrl.toString(),
    [SemanticAttributes.DB_USER]: databaseUrl.username,
  };
}

export function getQueryId(queryContext: QueryContext): string {
  return [
    queryContext.connectionId,
    queryContext.poolId,
    queryContext.queryId,
  ].join("-");
}

export function getQueryOperationName(sql: string): string {
  const words = sql
    .trim()
    .split(" ")
    .filter((word) => word.length > 0);
  return words.length > 0 ? words[0].toLowerCase() : "unknown";
}
