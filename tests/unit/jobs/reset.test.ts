import { describe, expect, test } from "vitest";

import { resetCounters } from "../../../src/server/jobs/reset";
import { FakeRepos } from "../../fakes/fake-repos";

describe("resetCounters", () => {
  test("resets mailbox daily counters", async () => {
    const repos = new FakeRepos({
      mailboxes: [
        { id: "mailbox_1", orgId: "org_1", email: "one@example.com", sentToday: 3 },
        { id: "mailbox_2", orgId: "org_1", email: "two@example.com", sentToday: 2 },
      ],
    });

    await expect(resetCounters({ repos })).resolves.toEqual({ status: "reset", count: 2 });
    expect(repos.mailboxes.data.map((mailbox) => mailbox.sentToday)).toEqual([0, 0]);
  });
});
