import { describe, expect, test } from "vitest";

import {
  getObservabilityContext,
  runWithObservabilityContext,
  withContext,
} from "../../../src/server/observability/context";

describe("observability context", () => {
  test("stores request context across async work", async () => {
    await runWithObservabilityContext(
      { requestId: "req_1", correlationId: "corr_1", userId: "user_1" },
      async () => {
        await Promise.resolve();
        expect(getObservabilityContext()).toMatchObject({
          requestId: "req_1",
          correlationId: "corr_1",
          userId: "user_1",
        });
      }
    );
  });

  test("merges child context without losing parent correlation", async () => {
    await runWithObservabilityContext({ requestId: "req_1", correlationId: "corr_1" }, () => {
      return withContext({ jobName: "campaign.send", orgId: "org_1" }, async () => {
        expect(getObservabilityContext()).toMatchObject({
          requestId: "req_1",
          correlationId: "corr_1",
          jobName: "campaign.send",
          orgId: "org_1",
        });
      });
    });
  });
});
