export class MailboxConnectionError extends Error {
  constructor(
    message: string,
    public readonly provider: string
  ) {
    super(message);
    this.name = "MailboxConnectionError";
  }
}

export class TokenRefreshError extends Error {
  constructor(
    message: string,
    public readonly provider?: string
  ) {
    super(message);
    this.name = "TokenRefreshError";
  }
}
