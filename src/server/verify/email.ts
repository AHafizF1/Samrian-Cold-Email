import type { EmailVerificationResult, EmailVerifier } from "../ports";
import { readJsonResponse } from "../http/body";

export type EmailVerifierEnv = {
  EMAIL_VERIFIER_URL?: string;
  EMAIL_VERIFIER_API_KEY?: string;
  EMAIL_VERIFIER_PROVIDER?: string;
};

export function createEmailVerifier(
  env: EmailVerifierEnv = process.env as EmailVerifierEnv
): EmailVerifier | undefined {
  if (!env.EMAIL_VERIFIER_URL) return undefined;
  return new HttpEmailVerifier({
    url: env.EMAIL_VERIFIER_URL,
    apiKey: env.EMAIL_VERIFIER_API_KEY,
    provider: env.EMAIL_VERIFIER_PROVIDER ?? "http",
  });
}

export class HttpEmailVerifier implements EmailVerifier {
  constructor(
    private readonly config: { url: string; apiKey?: string; provider: string },
    private readonly request: typeof fetch = fetch
  ) {}

  async verify(email: string): Promise<EmailVerificationResult> {
    let response: Response;
    try {
      response = await this.request(this.config.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return {
        status: "unverifiable",
        reason: "provider-unavailable",
        provider: this.config.provider,
        checkedAt: Date.now(),
      };
    }

    if (!response.ok) {
      return {
        status: "unverifiable",
        reason: `http-${response.status}`,
        provider: this.config.provider,
        checkedAt: Date.now(),
      };
    }

    const body = await readJsonResponse<Partial<EmailVerificationResult>>(response, 64 * 1024);
    return {
      status: isVerificationStatus(body.status) ? body.status : "unverifiable",
      reason: typeof body.reason === "string" ? body.reason : undefined,
      provider: typeof body.provider === "string" ? body.provider : this.config.provider,
      checkedAt: typeof body.checkedAt === "number" ? body.checkedAt : Date.now(),
    };
  }
}

function isVerificationStatus(value: unknown): value is EmailVerificationResult["status"] {
  return value === "valid" || value === "invalid" || value === "risky" || value === "unverifiable";
}
