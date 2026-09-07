export type UserRole = "user" | "admin" | "super_admin";

export type TripStatus =
  | "intake"
  | "payment_pending"
  | "paid"
  | "generating"
  | "draft"
  | "approved"
  | "active"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type TimeSlot = "morning" | "afternoon" | "evening" | "night";

export type ActivityType =
  | "accommodation"
  | "transport"
  | "dining"
  | "attraction"
  | "experience"
  | "rest";

export type ItemStatus =
  | "draft"
  | "booked_flexible"
  | "booked_locked"
  | "cancelled"
  | "flagged";

export type LoyaltyTier = "explorer" | "adventurer" | "wanderer";

export interface IntakeData {
  who?: string;
  vibe?: string;
  when?: string;
  where?: string;
  budget?: string;
  pacing?: string;
  specialNeeds?: string;
  surpriseMode?: boolean;
}

export interface Trip {
  id: string;
  user_id: string;
  public_id: string;
  status: TripStatus;
  payment_status: PaymentStatus;
  planning_fee_idr: number;
  is_group_trip: boolean;
  is_surprise_mode: boolean;
  intake_data: IntakeData | null;
  selected_comparison_option: number | null;
  total_est_cost_idr: number | null;
  trip_start_date?: string | null;
  trip_end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComparisonOption {
  id: string;
  trip_id: string;
  option_number: number;
  summary: {
    title: string;
    destinationHighlights: string[];
    vibeTags: string[];
    estimatedBudgetIdr: number;
    rationale: string;
  };
  is_selected: boolean;
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  day_number: number;
  time_slot: TimeSlot;
  sort_order: number;
  activity_type: ActivityType;
  vendor_id: string | null;
  title: string;
  description: string;
  tips: string | null;
  est_cost_idr: number;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  status: ItemStatus;
  source: "internal_db" | "web_search" | "provider_api" | "manual_cs";
  booking_url: string | null;
  booking_ref: string | null;
  flagged_reason?: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  email?: string | null;
  whatsapp_number: string | null;
  travel_preferences?: {
    vibe?: string[];
    budget_tier?: string;
  } | null;
  role: UserRole;
  points_balance: number;
  lifetime_points: number;
  loyalty_tier: LoyaltyTier;
  onboarding_completed?: boolean;
}

export interface VendorSummary {
  id: string;
  name: string;
  type: string;
  city: string;
  whatsapp_number: string | null;
  is_verified: boolean;
}

export interface TripPhoto {
  id: string;
  trip_id: string;
  user_id: string;
  storage_path: string;
  public_url?: string;
  caption: string | null;
  uploaded_at: string;
}

export interface FlaggedQueueItem {
  id: string;
  trip_id: string;
  item_id: string | null;
  status: "pending" | "approved" | "rejected" | "edited_manual";
  requested_change: Record<string, unknown> | null;
  reviewed_at: string | null;
  created_at: string;
  trip_public_id: string;
  item_title: string | null;
}

type ChatRole = "user" | "assistant" | "cs";

export interface CSChatMessage {
  role: ChatRole;
  content: string;
  ts: string;
}

export interface CSChatSession {
  id: string;
  trip_id: string;
  user_id: string;
  cs_id: string | null;
  status: "open" | "resolved";
  messages: CSChatMessage[];
  created_at: string;
  updated_at: string;
}
