import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { InboxAttachments } from "../../src/components/inbox/attachments";

describe("inbox attachments", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });
  });

  test("warns before first download and never previews inline", async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetch);
    render(
      <InboxAttachments
        threadId="thread_1"
        attachments={[
          {
            id: "attachment_1",
            filename: "invoice.pdf",
            size: 3,
            contentType: "application/pdf",
            inline: false,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /download invoice.pdf/i }));
    expect(screen.getByText(/no screening guarantees safety/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector("iframe, embed, object")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /download anyway/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/inbox/threads/thread_1/attachments/attachment_1")
    );
  });
});
