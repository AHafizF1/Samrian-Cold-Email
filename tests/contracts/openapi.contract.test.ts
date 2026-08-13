import { getOpenApiDocument, operations } from "../../packages/contracts/src";
import { describe, expect, it } from "vitest";

describe("OpenAPI contract", () => {
  it("publishes every registered operation with bearer auth", () => {
    const document = getOpenApiDocument();
    const listed = Object.values(document.paths ?? {}).flatMap((path) =>
      Object.values(path ?? {}).map(
        (operation) => (operation as { operationId?: string }).operationId
      )
    );

    expect(document.openapi).toBe("3.1.0");
    expect(listed).toEqual(expect.arrayContaining(operations.map((operation) => operation.id)));
    expect(document.components?.securitySchemes).toHaveProperty("bearerAuth");
  });
});
