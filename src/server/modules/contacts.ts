import type {
  ContactId,
  ContactRecord,
  EmailVerificationResult,
  EmailVerifier,
  OrgId,
} from "../ports";

export type ContactEligibility = "eligible" | "invalid" | "blocked" | "hard-bounced";

export type ContactAssessment = {
  status: ContactEligibility;
  warnings: string[];
};

export type ContactImportRow = {
  email: string;
  customVars?: Record<string, unknown>;
  timezone?: string;
};

export type ContactImportError = {
  index: number;
  email: string;
  reason: string;
};

export type ContactImportReport = {
  created: number;
  updated: number;
  skipped: number;
  duplicateRows: number;
  invalidRows: number;
  blockedRows: number;
  hardBouncedRows: number;
  unverifiableRows: number;
  errors: ContactImportError[];
  ids: ContactId[];
};

export type ContactImportDeps = {
  contacts: {
    getByEmail(email: string, orgId: OrgId): Promise<ContactRecord | null>;
    create(input: {
      orgId: OrgId;
      email: string;
      domain: string;
      customVars?: Record<string, unknown>;
      timezone?: string;
      verification?: EmailVerificationResult;
    }): Promise<ContactRecord>;
    update(
      id: ContactId,
      orgId: OrgId,
      input: {
        email?: string;
        domain?: string;
        customVars?: Record<string, unknown>;
        timezone?: string;
        verificationStatus?: EmailVerificationResult["status"];
        verificationReason?: string;
        verificationProvider?: string;
        verificationCheckedAt?: number;
      }
    ): Promise<ContactRecord | null>;
  };
  blocklist: {
    isBlocked(email: string, orgId: OrgId): Promise<boolean>;
  };
  verifier?: EmailVerifier;
};

const STALE_VERIFICATION_MS = 1000 * 60 * 60 * 24 * 90;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function extractDomain(email: string): string {
  return normalizeEmail(email).split("@")[1] ?? "";
}

export function validateEmail(email: string): { ok: true } | { ok: false; reason: string } {
  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1] || /\s/.test(normalized)) {
    return { ok: false, reason: "invalid-syntax" };
  }

  const domain = parts[1];
  if (
    !domain.includes(".") ||
    domain.includes("..") ||
    domain.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) ||
    !/[a-z]{2,}$/.test(domain)
  ) {
    return { ok: false, reason: "invalid-domain" };
  }

  return { ok: true };
}

export async function assessContact(
  contact: ContactRecord,
  deps: { isBlocked(email: string, orgId: OrgId): Promise<boolean>; now?: number }
): Promise<ContactAssessment> {
  const valid = validateEmail(contact.email);
  if (!valid.ok || contact.verificationStatus === "invalid") {
    return { status: "invalid", warnings: [] };
  }

  if (contact.bounceStatus === "hard") {
    return { status: "hard-bounced", warnings: [] };
  }

  if (await deps.isBlocked(contact.email, contact.orgId)) {
    return { status: "blocked", warnings: [] };
  }

  const warnings = verificationWarnings(contact, deps.now ?? Date.now());
  return { status: "eligible", warnings };
}

export async function importContacts(
  input: { orgId: OrgId; rows: ContactImportRow[] },
  deps: ContactImportDeps
): Promise<ContactImportReport> {
  return processContacts(input, deps, true);
}

export async function previewContacts(
  input: { orgId: OrgId; rows: ContactImportRow[] },
  deps: ContactImportDeps
): Promise<ContactImportReport> {
  return processContacts(input, deps, false);
}

async function processContacts(
  input: { orgId: OrgId; rows: ContactImportRow[] },
  deps: ContactImportDeps,
  write: boolean
): Promise<ContactImportReport> {
  const report = emptyReport();
  const seen = new Set<string>();

  for (let index = 0; index < input.rows.length; index++) {
    const row = input.rows[index];
    const email = normalizeEmail(row.email);
    const domain = extractDomain(email);

    if (seen.has(email)) {
      addSkipped(report, "duplicateRows", { index, email, reason: "duplicate-row" });
      continue;
    }
    seen.add(email);

    const valid = validateEmail(email);
    if (!valid.ok) {
      addSkipped(report, "invalidRows", { index, email, reason: valid.reason });
      continue;
    }

    const existing = await deps.contacts.getByEmail(email, input.orgId);
    if (await deps.blocklist.isBlocked(email, input.orgId)) {
      addSkipped(report, "blockedRows", { index, email, reason: "blocked" });
      continue;
    }
    if (existing?.bounceStatus === "hard") {
      addSkipped(report, "hardBouncedRows", { index, email, reason: "hard-bounced" });
      continue;
    }

    const verification = deps.verifier ? await deps.verifier.verify(email) : undefined;
    if (verification?.status === "invalid") {
      addSkipped(report, "invalidRows", { index, email, reason: "invalid-verification" });
      continue;
    }
    if (verification?.status === "risky" || verification?.status === "unverifiable") {
      report.unverifiableRows += 1;
    }

    if (existing) {
      if (write) {
        const updated = await deps.contacts.update(existing.id, input.orgId, {
          email,
          domain,
          customVars: row.customVars,
          timezone: row.timezone,
          ...verificationPatch(verification),
        });
        if (updated) report.ids.push(updated.id);
      }
      report.updated += 1;
      continue;
    }

    if (write) {
      const created = await deps.contacts.create({
        orgId: input.orgId,
        email,
        domain,
        customVars: row.customVars,
        timezone: row.timezone,
        verification,
      });
      report.ids.push(created.id);
    }
    report.created += 1;
  }

  return report;
}

function verificationWarnings(contact: ContactRecord, now: number): string[] {
  const warnings: string[] = [];
  if (contact.verificationStatus === "risky" || contact.verificationStatus === "unverifiable") {
    warnings.push(`verification:${contact.verificationStatus}`);
  }
  if (
    contact.verificationCheckedAt &&
    contact.verificationStatus &&
    now - contact.verificationCheckedAt > STALE_VERIFICATION_MS
  ) {
    warnings.push("verification:stale");
  }
  return warnings;
}

function verificationPatch(verification: EmailVerificationResult | undefined) {
  return verification
    ? {
        verificationStatus: verification.status,
        verificationReason: verification.reason,
        verificationProvider: verification.provider,
        verificationCheckedAt: verification.checkedAt,
      }
    : {};
}

function addSkipped(
  report: ContactImportReport,
  key: "duplicateRows" | "invalidRows" | "blockedRows" | "hardBouncedRows",
  error: ContactImportError
) {
  report[key] += 1;
  report.skipped += 1;
  report.errors.push(error);
}

function emptyReport(): ContactImportReport {
  return {
    created: 0,
    updated: 0,
    skipped: 0,
    duplicateRows: 0,
    invalidRows: 0,
    blockedRows: 0,
    hardBouncedRows: 0,
    unverifiableRows: 0,
    errors: [],
    ids: [],
  };
}
