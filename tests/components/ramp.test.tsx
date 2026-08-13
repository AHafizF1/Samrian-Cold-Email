import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import SettingsPage from "../../src/app/dashboard/settings/page";
import { ReviewStep } from "../../src/app/dashboard/campaigns/new/wizard/steps/review";
import type { CampaignDraft } from "../../src/app/dashboard/campaigns/new/wizard/page";

describe("mailbox ramp settings", () => {
  beforeEach(() => vi.restoreAllMocks());

  test("loads and saves sending defaults", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/settings/sending" && init?.method === "PATCH") {
        return Response.json(JSON.parse(String(init.body)));
      }
      if (url === "/api/settings/sending") {
        return Response.json({
          defaultRampEnabled: true,
          defaultRampTarget: 25,
          replyReserve: 3,
        });
      }
      if (url === "/api/settings/compliance") return Response.json({});
      if (url === "/api/settings/notifications") return Response.json({});
      if (url === "/api/settings/api-keys") return Response.json([]);
      return Response.json({}, { status: 404 });
    });

    render(<SettingsPage />);

    expect(await screen.findByDisplayValue("25")).toBeInTheDocument();
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
    expect(screen.getByText(/does not send synthetic warmup messages/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Default target per day"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save sending" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/settings/sending",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"defaultRampTarget":30'),
        })
      )
    );
  });

  test("warns when selected mailboxes cannot cover today's target volume", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/mailboxes") {
        return Response.json({
          mailboxes: [
            { _id: "mailbox_1", availableToday: 6 },
            { _id: "mailbox_2", availableToday: 20 },
          ],
        });
      }
      return Response.json({}, { status: 404 });
    });
    const draft: CampaignDraft = {
      name: "Launch",
      steps: [{ subject: "Hello", body: "Body" }],
      schedule: {
        daysAllowed: ["monday"],
        startTime: "09:00",
        endTime: "17:00",
        defaultTimezone: "UTC",
      },
      targetContactIds: Array.from({ length: 10 }, (_, index) => `contact_${index}`),
      mailboxIds: ["mailbox_1"],
    };

    render(<ReviewStep draft={draft} setDraft={vi.fn()} />);

    expect(
      await screen.findByText(/selected mailboxes have 6 sends available today for 10 contacts/i)
    ).toBeInTheDocument();
  });
});
