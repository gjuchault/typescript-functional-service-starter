import camelCase from "camelcase";
import { compile as jsonSchemaToInterface } from "json-schema-to-typescript";
import jsonSchemaToZod from "json-schema-to-zod";
import type { Endpoint } from "./endpoint";

interface OpenApi {
  paths: Record<string, OpenApiPath>;
}

interface OpenApiPath {
  summary?: string;
  description?: string;
  get?: OpenApiOperation;
  put?: OpenApiOperation;
  post?: OpenApiOperation;
  delete?: OpenApiOperation;
  options?: OpenApiOperation;
  head?: OpenApiOperation;
  patch?: OpenApiOperation;
  trace?: OpenApiOperation;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  deprecated?: boolean;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponse>;
}

export interface OpenApiParameter {
  name: string;
  in: "query" | "path";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
}

interface OpenApiRequestBody {
  description?: string;
  content: Record<string, OpenApiContentSchema>;
}

interface OpenApiResponse {
  description?: string;
  content: Record<string, OpenApiContentSchema>;
}

interface OpenApiContentSchema {
  schema: any;
}

export async function parse(input: OpenApi): Promise<{
  endpoints: Endpoint[];
  interfaces: string[];
}> {
  const endpoints: Endpoint[] = [];
  const interfaces: string[] = [];

  for (const [path, endpoint] of Object.entries(input.paths)) {
    const { summary, description } = endpoint;
    const methods = [
      "get",
      "put",
      "post",
      "delete",
      "options",
      "head",
      "patch",
      "trace",
    ] as const;
    for (const method of methods) {
      const operation = endpoint[method];

      if (!operation) {
        continue;
      }

      const name = generateMethodName(method, path);

      const body = await parseBody(name, operation);

      let bodyType: string | undefined = undefined;
      if (body !== undefined) {
        bodyType = body.interfaceName;
        interfaces.push(body.interfaceContent);
      }

      const responses = parseResponses(name, operation);

      interfaces.push(...responses.interfaceContents);

      endpoints.push({
        name,
        method,
        path,
        summary: operation.summary ?? summary,
        description: operation.description ?? description,
        deprecated: operation.deprecated ?? false,
        parameters: operation.parameters,
        bodyType: bodyType,
        responseType:
          responses.interfaceNames.length === 0
            ? undefined
            : responses.interfaceNames.join(" | "),
      });
    }
  }

  return { endpoints, interfaces };
}

async function parseBody(
  name: string,
  operation: OpenApiOperation
): Promise<
  | {
      interfaceName: string;
      interfaceContent: string;
    }
  | undefined
> {
  if (
    operation.requestBody?.content["application/json"].schema.type !== "object"
  ) {
    return undefined;
  }

  const schema = operation.requestBody?.content["application/json"].schema;

  const interfaceName = [
    name.slice(0, 1).toUpperCase(),
    name.slice(1),
    "Body",
  ].join("");
  const interfaceContent = await jsonSchemaToInterface(schema, interfaceName, {
    bannerComment: "",
    format: false,
  });

  return { interfaceName, interfaceContent };
}

function parseResponses(
  name: string,
  operation: OpenApiOperation
): {
  interfaceNames: string[];
  interfaceContents: string[];
} {
  const interfaceNames: string[] = [];
  const interfaceContents: string[] = [];

  if (!operation.responses) {
    return {
      interfaceNames,
      interfaceContents,
    };
  }

  for (const [status, response] of Object.entries(operation.responses)) {
    if (Number(status) < 200 || Number(status) >= 300) {
      continue;
    }

    if (response.content?.["application/json"]?.schema === undefined) {
      continue;
    }

    const schema = response.content["application/json"].schema;

    const zodSchemaName = `${name}Body${status}Schema`;

    const interfaceContent = jsonSchemaToZod(schema, zodSchemaName, false);

    interfaceNames.push(zodSchemaName);
    interfaceContents.push(interfaceContent);
  }

  return {
    interfaceNames,
    interfaceContents,
  };
}

function generateMethodName(method: string, url: string) {
  // https://github.com/ferdikoomen/openapi-typescript-codegen/blob/b32c85e4eb59ff4951321472165063a8afbefa3a/src/openApi/v3/parser/getOperationName.ts#L18
  const urlWithoutPlaceholders = url
    .replace(/[^/]*?{api-version}.*?\//g, "")
    .replace(/{(.*?)}/g, "")
    .replace(/\//g, "-");

  return camelCase(`${method}-${urlWithoutPlaceholders}`);
}
