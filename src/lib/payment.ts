import crypto from "node:crypto";

import midtransClient from "midtrans-client";

const coreApi = new midtransClient.CoreApi({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY ?? "",
  clientKey: process.env.MIDTRANS_CLIENT_KEY ?? "",
});

export async function createQrisPayment(input: {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
}) {
  const chargeParams = {
    payment_type: "qris",
    transaction_details: {
      order_id: input.orderId,
      gross_amount: input.grossAmount,
    },
    customer_details: {
      first_name: input.customerName,
      email: input.customerEmail,
    },
    custom_expiry: {
      expiry_duration: 15,
      unit: "minute",
    },
  };

  return coreApi.charge(chargeParams);
}

export function verifyMidtransSignature(payload: {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}) {
  const hash = crypto
    .createHash("sha512")
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${process.env.MIDTRANS_SERVER_KEY ?? ""}`)
    .digest("hex");

  return hash === payload.signature_key;
}
