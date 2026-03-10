import { subDays } from "date-fns";

/**
 * Parse a relative date string (e.g. "2 weeks ago", "a month ago") into days-ago number.
 * Returns null if the string cannot be parsed.
 */
export function parseRelativeDateToDays(input: string): number | null {
  let normalized = input.trim().toLowerCase();

  // Strip "edited" prefix (Google reviews have "Edited 2 years ago")
  normalized = normalized.replace(/^edited\s+/, "");

  // "yesterday"
  if (normalized === "yesterday") return 1;
  // "today"
  if (normalized === "today") return 0;

  // "a/an <unit> ago"
  const aUnitMatch = normalized.match(/^an?\s+(hour|day|week|month|year)s?\s+ago$/);
  if (aUnitMatch) {
    return unitToDays(aUnitMatch[1], 1);
  }

  // "N <unit>(s) ago"
  const nUnitMatch = normalized.match(/^(\d+)\s+(hour|day|week|month|year)s?\s+ago$/);
  if (nUnitMatch) {
    const count = parseInt(nUnitMatch[1], 10);
    return unitToDays(nUnitMatch[2], count);
  }

  return null;
}

function unitToDays(unit: string, count: number): number {
  switch (unit) {
    case "hour":
      return count < 24 ? 0 : Math.round(count / 24); // hours → same day (today)
    case "day":
      return count;
    case "week":
      return count * 7;
    case "month":
      return count * 30;
    case "year":
      return count * 365;
    default:
      return count;
  }
}

/**
 * Given an array of days-ago values (one per review, in original row order),
 * resolve collisions so no two reviews share the same date.
 *
 * Returns Date objects in the same order as the input array.
 */
export function resolveImportDates(daysAgoValues: number[], baseDate?: Date): Date[] {
  const base = baseDate ?? new Date();

  if (daysAgoValues.length === 0) return [];

  // Create indexed entries to preserve original order
  const indexed = daysAgoValues.map((days, i) => ({ index: i, days }));

  // Sort by days ascending (most recent first)
  indexed.sort((a, b) => a.days - b.days);

  // Walk through and resolve collisions
  for (let i = 1; i < indexed.length; i++) {
    if (indexed[i].days <= indexed[i - 1].days) {
      indexed[i].days = indexed[i - 1].days + 1;
    }
  }

  // Convert back to dates in original order
  const result = new Array<Date>(daysAgoValues.length);
  for (const entry of indexed) {
    result[entry.index] = subDays(base, entry.days);
  }

  return result;
}
