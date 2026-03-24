/**
 * Timezone helper utility
 *
 * Checks whether the current time falls within a campaign's allowed sending window,
 * respecting the contact's timezone override or the campaign's default timezone.
 */
import { toZonedTime, format } from "date-fns-tz";
import { getDay } from "date-fns";

interface CampaignSchedule {
  defaultTimezone: string;
  daysAllowed: string[];
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

interface CampaignWithSchedule {
  schedule: CampaignSchedule;
}

interface ContactWithTimezone {
  timezone?: string;
}



/**
 * Returns true if `now` falls within the campaign's sending window for the
 * resolved timezone (contact override → campaign default).
 *
 * Day names in `daysAllowed` must be lowercase English weekday names
 * (e.g. "monday", "tuesday", …).
 */
export function isWithinSendingWindow(
  campaign: CampaignWithSchedule,
  contact: ContactWithTimezone,
  now: Date = new Date()
): boolean {
  const timezone = contact.timezone ?? campaign.schedule.defaultTimezone;

  // Resolve local date/time using date-fns-tz
  let localNow;
  try {
    localNow = toZonedTime(now, timezone);
  } catch (error) {
    // If timezone is invalid, fallback to UTC
    localNow = now;
  }

  const dayOfWeek = getDay(localNow); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = dayNames[dayOfWeek];

  const currentTime = format(localNow, "HH:mm");

  const { daysAllowed, startTime, endTime } = campaign.schedule;

  if (!daysAllowed.includes(dayName)) {
    return false;
  }

  // Handle cross-midnight schedule (e.g., 22:00 PM to 06:00 AM)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }

  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Validates an IANA timezone string.
 */
export function validateTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
