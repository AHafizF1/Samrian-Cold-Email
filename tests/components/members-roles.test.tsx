import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MembersRoles } from "@/components/members-roles";

const rolesResponse = {
  roles: [
    {
      id: "owner",
      name: "Owner",
      slug: "owner",
      permissions: ["settings:update"],
      builtIn: true,
    },
    {
      id: "role_1",
      name: "Campaign operator",
      slug: "campaign-operator",
      permissions: ["campaign:read"],
      builtIn: false,
    },
  ],
  permissions: ["campaign:read", "campaign:launch", "settings:update"],
};

describe("members and roles", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("separates built-in and custom roles", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(rolesResponse))
      .mockResolvedValueOnce(
        Response.json([
          {
            id: "member_1",
            userId: "user_1",
            email: "owner@example.com",
            name: "Owner",
            role: "owner",
          },
        ])
      );

    render(<MembersRoles />);

    expect(await screen.findByRole("heading", { name: "Built-in roles" })).toBeInTheDocument();
    expect(screen.getAllByText("Campaign operator").length).toBeGreaterThan(0);
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
  });

  it("creates custom role from selected permissions", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(rolesResponse))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(
        Response.json({
          id: "role_2",
          name: "Launcher",
          slug: "launcher",
          permissions: ["campaign:launch"],
          builtIn: false,
        })
      )
      .mockResolvedValueOnce(Response.json(rolesResponse));

    render(<MembersRoles />);
    await screen.findByLabelText("campaign:launch");
    fireEvent.change(screen.getByLabelText("Role name"), { target: { value: "Launcher" } });
    fireEvent.click(screen.getByLabelText("campaign:launch"));
    fireEvent.click(screen.getByRole("button", { name: "Create role" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/settings/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Launcher", permissions: ["campaign:launch"] }),
      })
    );
  });

  it("invites a member with selected role", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(rolesResponse))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json({ invited: true }));

    render(<MembersRoles />);
    await waitFor(() =>
      expect(screen.getByLabelText("Invite role").querySelectorAll("option")).toHaveLength(2)
    );
    fireEvent.change(screen.getByLabelText("Invite email"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Invite role"), {
      target: { value: "campaign-operator" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/settings/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@example.com", role: "campaign-operator" }),
      })
    );
  });

  it("shows load errors without exposing a broken editor", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Could not load roles"));

    render(<MembersRoles />);

    expect(await screen.findByRole("status")).toHaveTextContent("Could not load roles");
    expect(screen.getByRole("button", { name: "Create role" })).toBeDisabled();
  });

  it("shows an empty member state and supports keyboard role editing", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(rolesResponse))
      .mockResolvedValueOnce(Response.json([]));

    render(<MembersRoles />);

    expect(await screen.findByText("No members found.")).toBeInTheDocument();

    const edit = screen.getByRole("button", { name: "Edit Campaign operator" });
    edit.focus();
    expect(edit).toHaveFocus();
    fireEvent.click(edit);

    expect(screen.getByLabelText("Role name")).toHaveValue("Campaign operator");
    expect(screen.getByRole("button", { name: "Update role" })).toBeInTheDocument();
  });
});
