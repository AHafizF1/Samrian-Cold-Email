import type { EmailVerificationResult, EmailVerifier } from "../../src/server/ports";

export class FakeVerifier implements EmailVerifier {
  constructor(
    private readonly results: Record<string, EmailVerificationResult> = {},
    private readonly fallback: EmailVerificationResult = {
      status: "valid",
      provider: "fake",
      checkedAt: 0,
    }
  ) {}

  async verify(email: string): Promise<EmailVerificationResult> {
    return this.results[email.toLowerCase()] ?? this.fallback;
  }
}
