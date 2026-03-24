import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ paymentStatus: "pending" }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return Response.json({ error: "orderId is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("trips")
    .select("payment_status,status")
    .eq("payment_ref", orderId)
    .single();

  if (error || !data) {
    return Response.json({ paymentStatus: "pending" }, { status: 200 });
  }

  return Response.json({
    paymentStatus: data.payment_status,
    tripStatus: data.status,
  });
}
