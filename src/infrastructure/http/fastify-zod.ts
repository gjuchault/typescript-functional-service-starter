import type { JSONObject } from "@fastify/swagger";
import type { FastifyTypeProvider } from "fastify";
import type {
  FastifyRouteSchemaDef,
  FastifySchema,
} from "fastify/types/schema";
import { z, ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface ZodTypeProvider extends FastifyTypeProvider {
  readonly output: this["input"] extends z.ZodSchema ? z.infer<this["input"]> : never;
}

export function validatorCompiler({
  schema,
}: FastifyRouteSchemaDef<ZodType<unknown>>) {
  return (data: unknown) => {
    const zodResult = schema.safeParse(data);

    return zodResult.success
      ? { value: zodResult.data }
      : { error: zodResult.error };
  };
}

export function serializerCompiler() {
  return (data: ZodType) => {
    return JSON.stringify(data);
  };
}

export function swaggerTransform({
  schema,
  url,
}: {
  readonly schema: FastifySchema;
  readonly url: string;
}): {
  readonly schema: JSONObject;
  readonly url: string;
} {
  let transformedResponse: Record<string, JSONObject> | undefined;

  if (schema.response) {
    transformedResponse = {};

    for (const [statusCode, responseSchema] of Object.entries(
      schema.response as Record<string, { readonly properties?: ZodType } | undefined>
    )) {
      if (responseSchema?.properties) {
        // skip unsafe keys injection
        if (!Number.isSafeInteger(Number(statusCode))) {
          continue;
        }

        // eslint-disable-next-line security/detect-object-injection
        transformedResponse[statusCode] = zodToJsonSchema(
          responseSchema.properties
        ) as JSONObject;
      }
    }
  }

  const transformedSchema = {
    body: schema.body ? zodToJsonSchema(schema.body as ZodType) : undefined,
    querystring: schema.querystring
      ? zodToJsonSchema(schema.querystring as ZodType)
      : undefined,
    params: schema.params
      ? zodToJsonSchema(schema.params as ZodType)
      : undefined,
    headers: schema.headers
      ? zodToJsonSchema(schema.headers as ZodType)
      : undefined,
    response: transformedResponse,
  };

  return {
    schema: transformedSchema as JSONObject,
    url,
  };
}
