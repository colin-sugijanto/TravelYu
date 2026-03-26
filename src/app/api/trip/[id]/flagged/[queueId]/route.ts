import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; queueId: string }> },
) {
  const { id, queueId } = await params;
  const body = (await request.json()) as {
    action?: "approve" | "reject" | "edit_manual";
  };

  const action = body.action;
  if (!action) {
    return Response.json({ error: "action is required" }, { status: 400 });
  }

  const statusMap = {
    approve: "approved",
    reject: "rejected",
    edit_manual: "edited_manual",
  } as const;

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(appUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: queueItem } = await supabaseAdmin
    .from("cs_approval_queue")
    .select("id,trip_id,item_id,status,requested_change")
    .eq("id", queueId)
    .eq("trip_id", id)
    .maybeSingle();

  if (!queueItem) {
    return Response.json({ error: "Queue item not found" }, { status: 404 });
  }

  if (queueItem.status !== "pending") {
    return Response.json({ error: "Queue item already reviewed" }, { status: 400 });
  }

  const nextStatus = statusMap[action];

  const { error: queueError } = await supabaseAdmin
    .from("cs_approval_queue")
    .update({
      status: nextStatus,
      cs_id: appUser.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueId);

  if (queueError) {
    return Response.json({ error: queueError.message }, { status: 500 });
  }

  if (action === "approve" && queueItem.item_id) {
    const requested = (queueItem.requested_change as Record<string, unknown> | null) ?? {};
    const type = String(requested.type ?? "");

    if (type === "swap_vendor" && typeof requested.new_vendor_id === "string") {
      await supabaseAdmin
        .from("itinerary_items")
        .update({
          vendor_id: requested.new_vendor_id,
          status: "booked_flexible",
          resolved_at: new Date().toISOString(),
          flagged_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueItem.item_id);
    }

    if (type === "delete_item") {
      await supabaseAdmin.from("itinerary_items").delete().eq("id", queueItem.item_id);
    }
  }

  if (action === "reject" && queueItem.item_id) {
    await supabaseAdmin
      .from("itinerary_items")
      .update({
        status: "booked_flexible",
        flagged_reason: "Perubahan ditolak CS",
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queueItem.item_id);
  }

  return Response.json({ ok: true });
}
