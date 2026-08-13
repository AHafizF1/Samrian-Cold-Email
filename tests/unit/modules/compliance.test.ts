import { describe, expect, test } from "vitest";

import {
  applyCompliance,
  buildComplianceHeaders,
  validateComplianceForLaunch,
} from "../../../src/server/modules/compliance";

describe("compliance module", () => {
  test("disabled mode sends no unsubscribe headers and requires no identity", () => {
    expect(
      buildComplianceHeaders({
        enabled: false,
        appUrl: "https://app.example.com",
        contactId: "contact_1",
        campaignId: "campaign_1",
        token: "token",
      })
    ).toEqual({});

    expect(validateComplianceForLaunch({ listUnsubscribeEnabled: false })).toEqual([]);
  });

  test("enabled mode requires physical address and footer token", () => {
    expect(
      validateComplianceForLaunch({
        listUnsubscribeEnabled: true,
        physicalAddress: "",
        unsubscribeFooter: "Opt out",
      })
    ).toEqual([
      "Physical mailing address is required when List-Unsubscribe is enabled",
      "Unsubscribe footer must include {{unsubscribeUrl}} when List-Unsubscribe is enabled",
    ]);
  });

  test("enabled mode builds one-click headers with optional mailto", () => {
    expect(
      buildComplianceHeaders({
        enabled: true,
        appUrl: "https://app.example.com",
        contactId: "contact_1",
        campaignId: "campaign_1",
        token: "token",
        mailto: "unsubscribe@example.com",
      })
    ).toEqual({
      "List-Unsubscribe":
        "<https://app.example.com/api/unsubscribe?contactId=contact_1&c=campaign_1&t=token>, <mailto:unsubscribe@example.com>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  test("enabled mode appends footer to html and text", () => {
    expect(
      applyCompliance({
        enabled: true,
        rendered: { subject: "Hi", htmlBody: "<p>Hello</p>", textBody: "Hello" },
        unsubscribeUrl: "https://app.example.com/u",
        footer: "Mailing address: 1 Main St. Unsubscribe: {{unsubscribeUrl}}",
      })
    ).toMatchObject({
      htmlBody:
        '<p>Hello</p><p>Mailing address: 1 Main St. Unsubscribe: <a href="https://app.example.com/u">https://app.example.com/u</a></p>',
      textBody: "Hello\n\nMailing address: 1 Main St. Unsubscribe: https://app.example.com/u",
    });
  });
});
