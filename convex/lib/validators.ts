/**
 * Shared validation utilities for the Core Data Layer
 *
 * This module provides reusable validation functions to avoid code duplication
 * across mutations and queries. All validators follow the DRY principle and
 * maintain a single source of truth for validation logic.
 */

// ============================================================
// Status Constants (Single Source of Truth)
// ============================================================

/**
 * Valid campaign statuses
 */
export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/**
 * Valid contact assignment statuses
 */
export const CONTACT_STATUSES = [
  "active",
  "replied",
  "bounced",
  "unsubscribed",
  "completed",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/**
 * Valid bounce statuses
 */
export const BOUNCE_STATUSES = ["soft", "hard"] as const;
export type BounceStatus = (typeof BOUNCE_STATUSES)[number];

/**
 * Valid days of the week
 */
export const VALID_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type DayOfWeek = (typeof VALID_DAYS)[number];

// ============================================================
// Validation Functions
// ============================================================

/**
 * Validate IANA timezone string
 *
 * @param timezone - Timezone string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format (RFC 5322 basic validation)
 *
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  // RFC 5322 simplified regex for email validation
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * Validate time format (HH:MM in 24-hour format)
 *
 * @param time - Time string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
}

/**
 * Validate that startTime is before endTime
 *
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @returns true if startTime < endTime, false otherwise
 */
export function isStartBeforeEnd(startTime: string, endTime: string): boolean {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return startMinutes < endMinutes;
}

/**
 * Validate Unix timestamp (between year 2000 and 2100)
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns true if valid, false otherwise
 */
export function isValidTimestamp(timestamp: number): boolean {
  const minTimestamp = 946684800000; // Jan 1, 2000
  const maxTimestamp = 4102444800000; // Jan 1, 2100
  return timestamp >= minTimestamp && timestamp <= maxTimestamp;
}

/**
 * Validate customVars object (must be string key-value pairs)
 *
 * @param customVars - Object to validate
 * @returns true if valid, false otherwise
 */
export function isValidCustomVars(customVars: any): boolean {
  if (typeof customVars !== "object" || customVars === null || Array.isArray(customVars)) {
    return false;
  }

  for (const [key, value] of Object.entries(customVars)) {
    if (typeof key !== "string" || typeof value !== "string") {
      return false;
    }
  }

  return true;
}

/**
 * Validate campaign status
 *
 * @param status - Status string to validate
 * @returns true if valid, false otherwise
 */
export function isValidCampaignStatus(status: string): status is CampaignStatus {
  return CAMPAIGN_STATUSES.includes(status as CampaignStatus);
}

/**
 * Validate contact assignment status
 *
 * @param status - Status string to validate
 * @returns true if valid, false otherwise
 */
export function isValidContactStatus(status: string): status is ContactStatus {
  return CONTACT_STATUSES.includes(status as ContactStatus);
}

/**
 * Validate bounce status
 *
 * @param status - Status string to validate
 * @returns true if valid, false otherwise
 */
export function isValidBounceStatus(status: string): status is BounceStatus {
  return BOUNCE_STATUSES.includes(status as BounceStatus);
}

/**
 * Validate day of week
 *
 * @param day - Day string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDay(day: string): day is DayOfWeek {
  return VALID_DAYS.includes(day.toLowerCase() as DayOfWeek);
}
