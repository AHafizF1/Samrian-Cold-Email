import { describe, expect, test } from "vitest";

import {
  buildSendOptions,
  buildUnsubscribeHeaders,
  getCampaignStep,
  getMailboxFromAddress,
  renderEmail,
} from "../../src/server/jobs/send";

describe("campaign send", () => {
  test("renders spintax and contact variables for the selected step", () => {
    const step = getCampaignStep(
      [
        { subject: "Unused", body: "Unused" },
        { subject: "{Hi|Hello} {{firstName}}", body: "<p>Welcome {{company}}</p>" },
      ],
      1
    );

    const rendered = renderEmail(step, {
      id: "contact_1",
      orgId: "org_1",
      email: "person@example.com",
      customVars: { firstName: "Ada", company: "Acme" },
    });

    expect(["Hi Ada", "Hello Ada"]).toContain(rendered.subject);
    expect(rendered.htmlBody).toBe("<p>Welcome Acme</p>");
    expect(rendered.textBody).toBe("Welcome Acme");
  });

  test("escapes untrusted contact variables by email output context", () => {
    const rendered = renderEmail(
      {
        subject: "Hello {{firstName}}",
        body: '<p>{{company}}</p><a href="{{website}}">Visit</a>',
      },
      {
        id: "contact_1",
        orgId: "org_1",
        email: "ada@example.com",
        customVars: {
          firstName: "Ada\r\nBcc: victim@example.com",
          company: '<img src=x onerror="alert(1)">',
          website: "javascript:alert(1)",
        },
      }
    );

    expect(rendered.subject).toBe("Hello AdaBcc: victim@example.com");
    expect(rendered.htmlBody).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(rendered.htmlBody).not.toContain("javascript:");
    expect(rendered.htmlBody).not.toContain("<img");
  });

  test("builds unsubscribe headers and connector send options", () => {
    const headers = buildUnsubscribeHeaders({
      appUrl: "https://app.example.com",
      contactId: "contact_123",
      campaignId: "campaign_123",
      unsubscribeToken: "token",
    });

    expect(headers).toEqual({
      "List-Unsubscribe":
        "<https://app.example.com/api/unsubscribe?contactId=contact_123&c=campaign_123&t=token>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });

    expect(
      buildSendOptions({
        from: "sender@example.com",
        to: "person@example.com",
        rendered: { subject: "Subject", htmlBody: "<p>Body</p>", textBody: "Body" },
        headers,
      })
    ).toMatchObject({
      from: "sender@example.com",
      to: "person@example.com",
      subject: "Subject",
      html: "<p>Body</p>",
      text: "Body",
      headers,
    });
  });

  test("uses mailbox email for from address", () => {
    expect(
      getMailboxFromAddress({ id: "mailbox_1", orgId: "org_1", email: "user@example.com" })
    ).toBe("user@example.com");
  });
});
