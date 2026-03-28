import { z } from "zod";

export const tripIdSchema = z.object({
  tripId: z.string().min(1, "Trip ID is required"),
});

export const generateTripSchema = z.object({
  tripId: z.string().min(1, "Trip ID is required"),
  intakeData: z.record(z.string(), z.unknown()).optional(),
  selectedOption: z.number().int().min(1).max(3, "Selected option must be 1, 2, or 3").optional(),
});

export const compareOptionsSchema = z.object({
  tripId: z.string().min(1, "Trip ID is required"),
  intakeSummary: z.string().min(1, "Intake summary is required").max(5000, "Intake summary too long"),
});

export const selectOptionSchema = z.object({
  optionNumber: z.number().int().min(1).max(3, "Option number must be 1, 2, or 3"),
});

export const intakeChatSchema = z.object({
  tripId: z.string().min(1, "Trip ID is required"),
  mode: z.enum(["standard", "surprise"]).default("standard"),
  message: z.string().min(1, "Message is required").max(1000, "Message too long"),
});

export const flagItemSchema = z.object({
  tripId: z.string().min(1, "Trip ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
  reason: z.string().min(1, "Reason is required").max(500, "Reason too long"),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Name too long").optional(),
  whatsappNumber: z.string().max(20, "Phone number too long").optional(),
  travelPreferences: z.record(z.string(), z.unknown()).optional(),
});

export const uploadPhotoSchema = z.object({
  tripId: z.string().min(1, "Trip ID is required"),
  caption: z.string().max(500, "Caption too long").optional(),
});

export const redeemPointsSchema = z.object({
  points: z.number().int().min(500).max(1000),
});

export const notificationEventSchema = z.object({
  eventType: z.enum([
    "itinerary_ready",
    "cs_approved",
    "trip_reminder_h1",
    "vendor_contact",
    "trip_completed",
    "post_trip_review",
    "points_earned",
    "cs_reply",
  ]),
  tripId: z.string().optional(),
  userName: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phoneE164: z.string().optional().nullable(),
  channelPreference: z.enum(["email", "whatsapp", "both"]).optional(),
  subject: z.string().optional(),
  emailText: z.string().optional(),
  waText: z.string().optional(),
});

export function validateRequest<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));
    throw new ValidationError(errors);
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(
    public errors: Array<{ field: string; message: string }>,
    message = "Validation failed",
  ) {
    super(message);
    this.name = "ValidationError";
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors,
    };
  }
}
