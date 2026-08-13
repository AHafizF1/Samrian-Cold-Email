export type ComplianceSettings = {
  listUnsubscribeEnabled?: boolean;
  clickTrackingEnabled?: boolean;
  openTrackingEnabled?: boolean;
  physicalAddress?: string | null;
  unsubscribeFooter?: string | null;
  unsubscribeMailto?: string | null;
};

export type RenderedEmail = {
  subject: string;
  htmlBody: string;
  textBody: string;
};

export function validateComplianceForLaunch(settings: ComplianceSettings): string[] {
  if (!settings.listUnsubscribeEnabled) return [];

  const issues: string[] = [];
  if (!settings.physicalAddress?.trim()) {
    issues.push("Physical mailing address is required when List-Unsubscribe is enabled");
  }
  if (!settings.unsubscribeFooter?.includes("{{unsubscribeUrl}}")) {
    issues.push(
      "Unsubscribe footer must include {{unsubscribeUrl}} when List-Unsubscribe is enabled"
    );
  }
  return issues;
}

export function buildComplianceHeaders(input: {
  enabled: boolean;
  appUrl: string;
  contactId: string;
  campaignId: string;
  token: string;
  mailto?: string | null;
}): Record<string, string> {
  if (!input.enabled) return {};

  const unsubscribeUrl = buildUnsubscribeUrl(input);
  const values = [`<${unsubscribeUrl}>`];
  if (input.mailto?.trim()) values.push(`<mailto:${input.mailto.trim()}>`);

  return {
    "List-Unsubscribe": values.join(", "),
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function buildUnsubscribeUrl(input: {
  appUrl: string;
  contactId: string;
  campaignId: string;
  token: string;
}) {
  return `${input.appUrl}/api/unsubscribe?contactId=${input.contactId}&c=${input.campaignId}&t=${input.token}`;
}

export function applyCompliance(input: {
  enabled: boolean;
  rendered: RenderedEmail;
  unsubscribeUrl: string;
  footer?: string | null;
}): RenderedEmail {
  if (!input.enabled || !input.footer) return input.rendered;

  const footer = input.footer.replaceAll("{{unsubscribeUrl}}", input.unsubscribeUrl);
  return {
    subject: input.rendered.subject,
    htmlBody: `${input.rendered.htmlBody}<p>${escapeHtml(footer).replaceAll(
      input.unsubscribeUrl,
      `<a href="${input.unsubscribeUrl}">${input.unsubscribeUrl}</a>`
    )}</p>`,
    textBody: `${input.rendered.textBody}\n\n${footer}`,
  };
}

export function resolveListUnsubscribeEnabled(input: {
  orgEnabled?: boolean | null;
  campaignEnabled?: boolean | null;
}) {
  return input.campaignEnabled ?? input.orgEnabled ?? false;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
