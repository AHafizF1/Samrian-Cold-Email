import { describe, expect, test } from "vitest";

import {
  apiKeys,
  assignmentStatuses,
  blocklistReasons,
  campaignStatuses,
  emailEvents,
  emailEventTypes,
  contactAssignments,
  contacts,
  mailboxes,
  mailboxProviders,
  mailboxStatuses,
  threadDirections,
  threads,
} from "../../src/server/db/schema";

describe("db schema", () => {
  test("exports stable app tables", () => {
    expect(apiKeys).toBeTruthy();
    expect(contacts).toBeTruthy();
    expect(mailboxes).toBeTruthy();
    expect(contactAssignments).toBeTruthy();
    expect(threads).toBeTruthy();
    expect(emailEvents).toBeTruthy();
  });

  test("keeps closed domain values in one schema constants module", () => {
    expect(mailboxProviders).toEqual(["smtp", "puzzle", "mailpool", "google", "microsoft"]);
    expect(mailboxStatuses).toEqual(["active", "disconnected", "limit_reached"]);
    expect(campaignStatuses).toEqual(["draft", "active", "paused", "completed"]);
    expect(assignmentStatuses).toEqual([
      "active",
      "replied",
      "bounced",
      "unsubscribed",
      "completed",
    ]);
    expect(threadDirections).toEqual(["sent", "received"]);
    expect(blocklistReasons).toEqual(["unsubscribed", "bounced_hard", "manual"]);
    expect(emailEventTypes).toEqual([
      "sent",
      "failed",
      "reply",
      "unsubscribe",
      "bounce_hard",
      "bounce_soft",
      "auto_reply",
      "click",
      "open",
    ]);
  });
});
