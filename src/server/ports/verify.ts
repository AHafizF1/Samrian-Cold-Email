export type EmailVerificationStatus = "valid" | "invalid" | "risky" | "unverifiable";

export type EmailVerificationResult = {
  status: EmailVerificationStatus;
  reason?: string;
  provider: string;
  checkedAt: number;
};

export interface EmailVerifier {
  verify(email: string): Promise<EmailVerificationResult>;
}
