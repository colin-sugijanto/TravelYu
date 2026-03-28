/**
 * Validates an AI-generated itinerary before it is persisted to Supabase.
 * Returns a list of errors. If the array is empty, the itinerary is valid.
 */

export interface ItineraryItemLike {
  activityType?: string;
  title?: string;
  estCostIdr?: number;
  day?: number;
  timeSlot?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateItinerary(items: unknown[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(items) || items.length < 3) {
    errors.push(`Too few items: ${items?.length ?? 0}. Minimum 3.`);
    return { valid: false, errors };
  }

  const typed = items as ItineraryItemLike[];

  // Must have at least one dining item
  const hasDining = typed.some((i) => i.activityType === "dining");
  if (!hasDining) errors.push("No dining items — at least 1 meal required.");

  // Must have at least one accommodation
  const hasAccommodation = typed.some((i) => i.activityType === "accommodation");
  if (!hasAccommodation) errors.push("No accommodation item.");

  // Cost sanity check (in IDR)
  const totalCost = typed.reduce((sum, i) => sum + (i.estCostIdr ?? 0), 0);
  if (totalCost < 200_000) errors.push(`Total cost Rp ${totalCost.toLocaleString()} is unrealistically low.`);
  if (totalCost > 200_000_000) errors.push(`Total cost Rp ${totalCost.toLocaleString()} is unrealistically high.`);

  // No duplicate titles
  const titles = typed.map((i) => (i.title ?? "").trim().toLowerCase()).filter(Boolean);
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const t of titles) {
    if (seen.has(t)) dupes.push(t);
    seen.add(t);
  }
  if (dupes.length > 0) errors.push(`Duplicate item titles: ${dupes.slice(0, 3).join(", ")}`);

  // All items must have a day and activityType
  const invalidItems = typed.filter((i) => !i.day || !i.activityType || !i.title);
  if (invalidItems.length > 0) {
    errors.push(`${invalidItems.length} item(s) missing required fields (day/activityType/title).`);
  }

  return { valid: errors.length === 0, errors };
}
