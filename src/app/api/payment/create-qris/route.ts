import { nanoid } from "nanoid";

import { createQrisPayment } from "@/lib/payment";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!process.env.MIDTRANS_SERVER_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Payment service is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as {
    tripId: string;
    amount: number;
    customerName: string;
    customerEmail: string;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trip } = await supabaseAdmin.from("trips").select("id,user_id").eq("id", body.tripId).maybeSingle();
  if (!trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.user_id !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const orderId = `TRAVELYU-${nanoid(10).toUpperCase()}`;
  const payment = await createQrisPayment({
    orderId,
    grossAmount: body.amount,
    customerName: body.customerName,
    customerEmail: body.customerEmail,
  });

  await supabaseAdmin
    .from("trips")
    .update({
      status: "payment_pending",
      payment_status: "pending",
      payment_ref: orderId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.tripId);

  return Response.json({
    orderId,
    payment,
  });
}
