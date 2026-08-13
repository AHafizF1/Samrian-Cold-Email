export const mailboxProviders = ["smtp", "puzzle", "mailpool", "google", "microsoft"] as const;
export const mailboxStatuses = ["active", "disconnected", "limit_reached"] as const;
export const rampStatuses = [
  "disabled",
  "pending",
  "ramping",
  "ready",
  "held",
  "reduced",
  "paused",
  "recovering",
] as const;
export const campaignStatuses = ["draft", "active", "paused", "completed"] as const;
export const assignmentStatuses = [
  "active",
  "replied",
  "bounced",
  "unsubscribed",
  "completed",
] as const;
export const verificationStatuses = ["valid", "invalid", "risky", "unverifiable"] as const;
export const threadDirections = ["sent", "received"] as const;
export const blocklistReasons = ["unsubscribed", "bounced_hard", "manual"] as const;
export const emailEventTypes = [
  "sent",
  "failed",
  "reply",
  "unsubscribe",
  "bounce_hard",
  "bounce_soft",
  "auto_reply",
  "click",
  "open",
] as const;
export const groupLogicValues = ["AND", "OR"] as const;
export const groupOperators = [
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "in",
  "notIn",
  "gt",
  "gte",
  "lt",
  "lte",
  "exists",
  "notExists",
] as const;
