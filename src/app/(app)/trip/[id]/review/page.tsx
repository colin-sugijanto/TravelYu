"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Card, CardText, CardTitle } from "@/components/ui/card";

type ReviewVendor = {
  id: string;
  name: string;
  type: string;
  city: string;
  review: {
    rating: number;
    comment: string | null;
  } | null;
};

export default function TripReviewPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id ?? "";
  const [vendors, setVendors] = useState<ReviewVendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/trip/${encodeURIComponent(tripId)}/reviews`);
      if (!response.ok) return;

      const payload = await response.json();
      const rows = (payload.vendors ?? []) as ReviewVendor[];
      setVendors(rows);

      if (rows.length > 0) {
        const first = rows[0];
        setSelectedVendorId(first.id);
        setRating(first.review?.rating ?? 5);
        setComment(first.review?.comment ?? "");
      }
    };

    void load();
  }, [tripId]);

  useEffect(() => {
    const selected = vendors.find((vendor) => vendor.id === selectedVendorId);
    if (!selected) return;
    setRating(selected.review?.rating ?? 5);
    setComment(selected.review?.comment ?? "");
  }, [selectedVendorId, vendors]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedVendorId) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/trip/${encodeURIComponent(tripId)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          rating,
          comment,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error ?? "Gagal menyimpan review");
        return;
      }

      setVendors((prev) =>
        prev.map((vendor) =>
          vendor.id === selectedVendorId
            ? {
                ...vendor,
                review: {
                  rating,
                  comment: comment.trim() || null,
                },
              }
            : vendor,
        ),
      );
      setMessage("Review berhasil disimpan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl p-5">
      <CardTitle>Post-trip Vendor Review</CardTitle>
      <CardText className="mt-1">Rate vendor 1-5 stars dan tulis feedback untuk membantu traveler berikutnya.</CardText>

      <form className="mt-4 space-y-3" onSubmit={submit}>
        {vendors.length > 0 ? (
          <select
            value={selectedVendorId}
            onChange={(event) => setSelectedVendorId(event.target.value)}
            className="h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm"
          >
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name} ({vendor.type}, {vendor.city})
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-[var(--text-soft)]">Belum ada vendor dalam itinerary ini.</p>
        )}

        <select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="h-11 w-full rounded-xl border border-[var(--border)] px-4 text-sm">
          <option value={5}>Rating 5</option>
          <option value={4}>Rating 4</option>
          <option value={3}>Rating 3</option>
          <option value={2}>Rating 2</option>
          <option value={1}>Rating 1</option>
        </select>

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="min-h-32 w-full rounded-xl border border-[var(--border)] p-3 text-sm"
          placeholder="Bagaimana pengalamanmu?"
        />

        <button disabled={isSubmitting || !selectedVendorId} className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </button>

        {message ? <p className="text-xs text-[var(--text-soft)]">{message}</p> : null}
      </form>
    </Card>
  );
}
