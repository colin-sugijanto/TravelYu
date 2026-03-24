import { nanoid } from "nanoid";

import { createQrisPayment } from "@/lib/payment";
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
