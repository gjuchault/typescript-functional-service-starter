import type { OpenTelemetryPluginOptions } from "@autotelic/fastify-opentelemetry";
import {
  NetTransportValues,
  SemanticAttributes,
} from "@opentelemetry/semantic-conventions";
import type { FastifyRequest } from "fastify";
import { getConfig } from "../../../config";

export const ATTRIBUTE_ERROR_NAME = "error.name";
export const ATTRIBUTE_ERROR_MESSAGE = "error.message";
export const ATTRIBUTE_ERROR_STACK = "error.stack";

export const openTelemetryPluginOptions: OpenTelemetryPluginOptions = {
  exposeApi: true,
  wrapRoutes: true,
  formatSpanName(request) {
    const requestUrl = getAbsoluteUrl(request);
    // FIXME: is request.pathname optional?
    const target = (requestUrl.pathname as string | undefined) ?? "/";
    // FIXME: is request.routerPath optional?
    const pathname = (request.routerPath as string | undefined) ?? target;
    return `${request.method} ${pathname}`;
  },
  formatSpanAttributes: {
    request(request) {
      const config = getConfig();
      const requestUrl = getAbsoluteUrl(request);
      const headers = request.headers;
      const userAgent = headers["user-agent"];
      const ips = headers["x-forwarded-for"];
      const httpVersion = request.raw.httpVersion;

      // FIXME: is request.pathname optional?
      const target = (requestUrl.pathname as string | undefined) ?? "/";
      // FIXME: is request.routerPath optional?
      const pathname = (request.routerPath as string | undefined) ?? target;
      const clientIp = typeof ips === "string" ? ips.split(",")[0] : undefined;
      const netTransport =
        httpVersion === "QUIC"
          ? NetTransportValues.IP_UDP
          : NetTransportValues.IP_TCP;

      return {
        [SemanticAttributes.HTTP_URL]: requestUrl.toString(),
        [SemanticAttributes.HTTP_HOST]: requestUrl.host,
        [SemanticAttributes.NET_HOST_NAME]: requestUrl.hostname,
        [SemanticAttributes.HTTP_METHOD]: request.method,
        [SemanticAttributes.HTTP_ROUTE]: pathname,
        [SemanticAttributes.HTTP_CLIENT_IP]: clientIp,
        [SemanticAttributes.HTTP_TARGET]: target,
        [SemanticAttributes.HTTP_USER_AGENT]: userAgent,
        [SemanticAttributes.HTTP_FLAVOR]: httpVersion,
        [SemanticAttributes.HTTP_SERVER_NAME]: config.name,
        [SemanticAttributes.NET_TRANSPORT]: netTransport,
        ...getRequestContentLength(request),
      };
    },
    reply(reply) {
      return {
        [SemanticAttributes.HTTP_STATUS_CODE]: reply.statusCode,
      };
    },
    error(error) {
      return {
        [ATTRIBUTE_ERROR_NAME]: error.name,
        [ATTRIBUTE_ERROR_MESSAGE]: error.message,
        [ATTRIBUTE_ERROR_STACK]: error.stack,
      };
    },
  },
};

function getRequestContentLength(
  request: FastifyRequest
): Record<string, number> | undefined {
  const length = Number(request.headers["content-length"]);

  if (!Number.isSafeInteger(length)) {
    return;
  }

  const isRequestCompressed =
    request.headers["content-encoding"] !== undefined &&
    request.headers["content-encoding"] !== "identity";

  const attribute = isRequestCompressed
    ? SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH
    : SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH_UNCOMPRESSED;

  return {
    [attribute]: length,
  };
}

export function getAbsoluteUrl(request: FastifyRequest): URL {
  const protocol = request.protocol + ":";
  const host = request.hostname;
  const path = request.url;

  return new URL(protocol + "//" + host + path);
}
