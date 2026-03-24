export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatIdr(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function tierFromPoints(points: number) {
  if (points >= 2000) return "wanderer" as const;
  if (points >= 500) return "adventurer" as const;
  return "explorer" as const;
}

export function isMajorChange(input: {
  destinationChanged?: boolean;
  dateChanged?: boolean;
  hotelChanged?: boolean;
}) {
  return Boolean(input.destinationChanged || input.dateChanged || input.hotelChanged);
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
