import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { NotificationsBell } from "../../src/components/notifications";

describe("NotificationsBell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("renders unread badge and marks a notification read", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Response.json({ success: true });
      }
      return Response.json({
        unreadCount: 1,
        notifications: [
          {
            id: "notification_1",
            type: "reply",
            title: "New reply from ada@example.com",
            body: "Re: Hello",
            createdAt: 123,
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NotificationsBell />);
    await userEvent.click(screen.getByRole("button", { name: /notifications/i }));

    expect(await screen.findByText("New reply from ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /mark read/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/notifications/notification_1", {
        method: "PATCH",
      })
    );
  });
});
