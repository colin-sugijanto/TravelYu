import { revalidateTag } from "next/cache";

import { getCurrentAppUser, isAdminRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(appUser.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();

  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.status !== "draft") {
    return Response.json({ ok: true, unchanged: true });
  }

  const { error } = await supabaseAdmin
    .from("trips")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  revalidateTag(`trip:${id}`, "max");
  revalidateTag(`trip:${id}:items`, "max");
  revalidateTag("admin:metrics", "max");

  return Response.json({ ok: true });
}
