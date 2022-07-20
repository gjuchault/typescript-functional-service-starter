import type { OpenApiParameter } from "./parser";

export interface Endpoint {
  name: string;
  method:
    | "get"
    | "post"
    | "put"
    | "head"
    | "patch"
    | "delete"
    | "options"
    | "trace";
  path: string;
  summary?: string;
  description?: string;
  deprecated: boolean;
  parameters?: OpenApiParameter[];
  bodyType?: string;
  responseType?: string;
}
