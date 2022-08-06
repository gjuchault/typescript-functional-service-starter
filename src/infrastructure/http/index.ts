import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import openTelemetryPlugin from "@autotelic/fastify-opentelemetry";
import circuitBreaker from "@fastify/circuit-breaker";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import etag from "@fastify/etag";
import formbody from "@fastify/formbody";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import underPressure from "@fastify/under-pressure";
import {
  ContextConfigDefault,
  fastify as createFastify,
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  HTTPMethods,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
} from "fastify";
import type { RouteGenericInterface } from "fastify/types/route";
import type { ResolveFastifyReplyType } from "fastify/types/type-provider";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import type { Redis } from "ioredis";
import ms from "ms";
import type { ZodType } from "zod";
import type { Config } from "../../config";
import { createLogger } from "../../infrastructure/logger";
import { openTelemetryPluginOptions } from "../../infrastructure/telemetry/instrumentations/fastify";
import { metricsPlugin } from "../../infrastructure/telemetry/metrics/fastify";
import type { Telemetry } from "../telemetry";
import {
  serializerCompiler,
  swaggerTransform,
  validatorCompiler,
  ZodTypeProvider,
} from "./fastify-zod";

export interface HttpServer {
  readonly createRoute: ({
    method,
    url,
    schema,
    handler,
  }: {
    readonly method: HTTPMethods | readonly HTTPMethods[];
    readonly url: string;
    readonly schema: Schema;
    readonly handler: (request: FastifyRequest) => HandlerResult;
  }) => HttpServer;
}

interface Response {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Record<string, string>;
}

type HandlerResult = TE.TaskEither<Error, Response> | T.Task<Response>;

export type FastifyServer = FastifyInstance<
  Server,
  IncomingMessage,
  ServerResponse,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export type HttpRequest = FastifyRequest<
  RouteGenericInterface,
  Server,
  RawRequestDefaultExpression,
  ZodType,
  ZodTypeProvider
>;

export type HttpReply = FastifyReply<
  Server,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  RouteGenericInterface,
  ContextConfigDefault,
  ZodType,
  ZodTypeProvider,
  ResolveFastifyReplyType<ZodTypeProvider, ZodType, RouteGenericInterface>
>;

const requestTimeout = ms("120s");

export async function createHttpServer({
  config,
  redis,
  telemetry,
}: {
  readonly config: Config;
  readonly redis: Redis;
  readonly telemetry: Telemetry;
}) {
  const logger = createLogger("http", { config });

  const fastify: FastifyServer = createFastify({
    requestTimeout,
    logger: undefined,
    requestIdHeader: "x-request-id",
    genReqId() {
      return randomUUID();
    },
  }).withTypeProvider<ZodTypeProvider>();

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  await fastify.register(openTelemetryPlugin, openTelemetryPluginOptions);
  await fastify.register(metricsPlugin, telemetry);

  await fastify.register(circuitBreaker);
  await fastify.register(cookie, { secret: config.secret });
  await fastify.register(cors);
  await fastify.register(etag);
  await fastify.register(helmet);
  await fastify.register(formbody);
  await fastify.register(multipart);
  await fastify.register(rateLimit, { redis });
  await fastify.register(underPressure);

  await fastify.register(swagger, {
    routePrefix: "/docs",
    openapi: {
      info: {
        title: config.name,
        description: config.description,
        version: config.version,
      },
      externalDocs: {
        url: "https://example.com/docs",
        description: "More documentation",
      },
      tags: [],
    },
    uiConfig: {
      docExpansion: "full",
      deepLinking: false,
    },
    staticCSP: true,
    transform: swaggerTransform,
  });

  fastify.setNotFoundHandler(
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: fastify.rateLimit(),
    },
    function (_request, reply) {
      void reply.code(404).send();
    }
  );

  fastify.addHook("onRequest", (request, _response, done) => {
    logger.debug(`http request: ${request.method} ${request.url}`, {
      requestId: getRequestId(request),
      method: request.method,
      url: request.url,
      route: request.routerPath,
      userAgent: request.headers["user-agent"],
    })();

    done();
  });

  fastify.addHook("onResponse", (request, reply, done) => {
    logger.debug(
      `http reply: ${request.method} ${request.url} ${reply.statusCode}`,
      {
        requestId: getRequestId(request),
        method: request.method,
        url: request.url,
        route: request.routerPath,
        userAgent: request.headers["user-agent"],
        responseTime: Math.ceil(reply.getResponseTime()),
        httpStatusCode: reply.statusCode,
      }
    )();

    done();
  });

  fastify.addHook("onError", (request, reply, error, done) => {
    logger.error(`http error (${error.code}): ${error.name} ${error.message}`, {
      requestId: getRequestId(request),
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
      },
      method: request.method,
      url: request.url,
      route: request.routerPath,
      userAgent: request.headers["user-agent"],
      responseTime: Math.ceil(reply.getResponseTime()),
      httpStatusCode: reply.statusCode,
    })();

    done();
  });

  return {
    fastify: fastify,
    httpServer: makeFastifyFunctionalWrapper(fastify),
  };
}

// This is overridden by fastify-swagger
interface Schema {
  readonly description?: string;
  readonly body?: unknown;
  readonly querystring?: unknown;
  readonly params?: unknown;
  readonly headers?: unknown;
  readonly response?: unknown;
}

export function makeFastifyFunctionalWrapper(
  fastify: FastifyServer
): HttpServer {
  const httpServer = {
    createRoute({
      handler,
      method,
      url,
      schema,
    }: {
      readonly handler: (request: FastifyRequest) => HandlerResult;
      readonly method: HTTPMethods | readonly HTTPMethods[];
      readonly url: string;
      readonly schema: Schema;
    }) {
      fastify.route({
        async handler(request, reply) {
          const result = pipe(await handler(request)(), ensureEither);

          // TODO: improve error management. ApiError?
          if (E.isLeft(result)) {
            await reply.status(500).send(result.left);
            return;
          }

          if (result.right.headers) {
            await reply.headers(result.right.headers);
          }

          await reply.status(200).send(result.right.body);
        },
        method: method as HTTPMethods | HTTPMethods[],
        url,
        schema,
      });

      return httpServer;
    },
  };

  return httpServer;
}

function getRequestId(request: FastifyRequest): string | undefined {
  if (typeof request.id === "string") {
    return request.id;
  }

  return undefined;
}

function ensureEither(
  either: Response | E.Either<Error, Response>
): E.Either<Error, Response> {
  if ("_tag" in either) {
    return either;
  }

  return E.of(either);
}
