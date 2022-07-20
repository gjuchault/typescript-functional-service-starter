import type { Endpoint } from "./endpoint";

export function generate({
  endpoints,
  interfaces,
}: {
  endpoints: Endpoint[];
  interfaces: string[];
}) {
  const methods = endpoints.map((endpoint) => generateMethod(endpoint));

  return `
    /// <reference lib="dom" />
    import { z } from "zod";

    ${interfaces.join("\n")}

    type HttpResult<T> = { success: true; data: T } | { success: false; data: unknown }

    ${generateWrapper(
      [methods.join("\n\n"), generateReturnMethods(endpoints)].join("\n")
    )}

    ${generateTraceBuilder()}
  `;
}

function generateMethod(endpoint: Endpoint) {
  const parameters = generateParameters(endpoint);
  const { bodyType } = endpoint;

  return `
    async function ${endpoint.name}(
      ${parameters ? `parameters: ${parameters},` : ""}
      ${bodyType ? `body: ${bodyType},` : ""}
      fetchOverrides: RequestInit = {}
    ): Promise<${generateMethodReturnType(endpoint)}> {
      const url = new URL(${generateUrlPath(endpoint)}, baseUrl);
      ${generateQueryParameters(endpoint)}

      const { headers, ...fetchOverridesWithoutHeaders } = fetchOverrides;
      const { headers: globalHeaders, ...globalFetchOverridesWithoutHeaders } = globalFetchOverrides;

      const response = await fetch(url.toString(), {
        method: "${endpoint.method}",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          ...globalHeaders,
          ...headers,
        },
        ${bodyType ? `body: jsonStringifier(body),` : ""}
        ...globalFetchOverridesWithoutHeaders,
        ...fetchOverridesWithoutHeaders,
      });

      if (!response.ok) {
        return { success: false, data: await response.json() };
      }

      ${generateSuccessfulReturn(endpoint)}
    }
  `;
}

function generateMethodReturnType(endpoint: Endpoint) {
  if (endpoint.responseType === undefined) {
    return "HttpResult<void>";
  }

  return `HttpResult<z.infer<typeof ${endpoint.responseType}>>`;
}

function generateParameters(endpoint: Endpoint) {
  if (endpoint.parameters === undefined) {
    return undefined;
  }

  return `
    {
      ${endpoint.parameters.map(({ name }) => `${name}: string,\n`)}
    }
  `;
}

function generateUrlPath(endpoint: Endpoint) {
  let result = `"${endpoint.path}"`;

  for (const parameter of endpoint.parameters ?? []) {
    if (parameter.in === "query") {
      continue;
    }

    result += `.replace("{${parameter.name}}", parameters["${parameter.name}"])`;
  }

  return result;
}

function generateQueryParameters(endpoint: Endpoint) {
  if (endpoint.parameters === undefined) {
    return "";
  }

  const result: string[] = [];

  for (const parameter of endpoint.parameters) {
    if (parameter.in === "path") {
      continue;
    }

    result.push(
      `url.searchParams.append("${parameter.name}", parameters["${parameter.name}"]);`
    );
  }

  return result.join("\n");
}

function generateSuccessfulReturn(endpoint: Endpoint) {
  if (!endpoint.responseType) {
    return "return { success: true, data: undefined }";
  }

  return `
    const data = await response.json();
    return {
      success: true,
      headers: response.headers,
      data: ${endpoint.responseType}.parse(data)
    }
  `;
}

function generateWrapper(content: string) {
  return `
    export function createClient(
      baseUrl: string,
      globalFetchOverrides: RequestInit = {},
      jsonStringifier = JSON.stringify
    ) {
      ${content}
    }
  `;
}

function generateReturnMethods(endpoints: Endpoint[]) {
  const allMethods = endpoints.map((endpoint) => endpoint.name).join(",");

  return `
    return {
      ${allMethods}
    }
  `;
}

function generateTraceBuilder() {
  return `
    export function createTraceHeader({
      traceId,
      parentSpanId,
      version
    }: {
      traceId: string;
      parentSpanId: string;
      version?: string
    }) {
      return {
        traceparent: [
          version ?? "00",
          traceId,
          parentSpanId,
          "01"
        ].join("-")
      };
    }
  `;
}
