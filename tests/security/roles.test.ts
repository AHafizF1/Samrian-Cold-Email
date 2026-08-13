import { describe, expect, test } from "vitest";

import { admin, member, owner } from "../../lib/permissions";
import { getOperationPermissions, sessionOperations } from "../../src/server/auth/policy";
import { roleFixtures, securityFixtures } from "./fixtures";

describe("session role matrix", () => {
  test("owner, admin, and member permissions remain explicit", () => {
    expect(roleFixtures(securityFixtures.orgA).map((actor) => actor.role)).toEqual([
      "owner",
      "admin",
      "member",
    ]);
    expect(owner.statements.mailbox).toContain("delete");
    expect(admin.statements.settings).not.toContain("update");
    expect(member.statements.mailbox).toEqual(["read"]);
    expect(member.statements.contact).toEqual(["read"]);
    expect(member.statements.organization).toEqual([]);
    expect(member.statements.member).toEqual([]);
    expect(owner.statements.credential).toEqual(["create", "read", "delete"]);
    expect(admin.statements.credential).toEqual(["create", "read", "delete"]);
    expect(member.statements).not.toHaveProperty("credential");
  });

  test("only owner/admin can administer organization membership", () => {
    expect(owner.statements.member).toEqual(expect.arrayContaining(["create", "update", "delete"]));
    expect(admin.statements.member).toEqual(expect.arrayContaining(["create", "update", "delete"]));
    expect(member.statements.member).toEqual([]);
  });

  test("every session operation has an explicit built-in role decision", () => {
    const matrix = Object.fromEntries(
      Object.entries(sessionOperations).map(([name, operation]) => {
        const permissions = getOperationPermissions(operation);
        return [
          name,
          {
            owner: !permissions || owner.authorize(permissions).success,
            admin: !permissions || admin.authorize(permissions).success,
            member: !permissions || member.authorize(permissions).success,
          },
        ];
      })
    );

    expect(Object.values(matrix).every((decision) => decision.owner)).toBe(true);
    expect(
      Object.entries(matrix)
        .filter(([, decision]) => !decision.admin)
        .map(([name]) => name)
    ).toEqual(["complianceUpdate", "sendingSettingsUpdate"]);
    expect(
      Object.entries(matrix)
        .filter(([, decision]) => decision.member)
        .map(([name]) => name)
    ).toEqual([
      "analyticsRead",
      "blocklistList",
      "campaignAssignments",
      "campaignCreate",
      "campaignLaunch",
      "campaignList",
      "campaignRead",
      "campaignStats",
      "campaignUpdate",
      "contactsList",
      "contactRead",
      "groupList",
      "groupPreview",
      "groupRead",
      "inboxList",
      "inboxRead",
      "inboxReply",
      "inboxUpdate",
      "mailboxList",
      "mailboxRampRead",
      "notificationList",
      "notificationUpdate",
      "notificationUpdateAll",
      "roleList",
      "memberList",
      "complianceRead",
      "notificationSettingsRead",
      "notificationSettingsUpdate",
      "sendingSettingsRead",
    ]);
  });
});
