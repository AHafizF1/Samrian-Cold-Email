import { getOpenApiDocument } from "@samrian/contracts";

export function GET() {
  return Response.json(getOpenApiDocument());
}
