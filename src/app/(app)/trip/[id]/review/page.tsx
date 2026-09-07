"use client";

import Link from "next/link";
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

  const selected = vendors.find((vendor) => vendor.id === selectedVendorId);
  const reviewedCount = vendors.filter((v) => v.review !== null).length;

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
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <Link href={`/trip/${tripId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800">
        ← Kembali ke itinerary
      </Link>
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>⭐ Post-trip Vendor Review</CardTitle>
        {vendors.length > 0 ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            {reviewedCount}/{vendors.length} diulas
          </span>
        ) : null}
      </div>
      <CardText className="mt-1">Dapat +50 poin untuk tiap vendor pertama yang kamu ulas. Ulasanmu membantu traveler berikutnya.</CardText>

      <form className="mt-4 space-y-3" onSubmit={submit}>
        {vendors.length > 0 ? (
          <>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">Vendor</span>
          <select
            value={selectedVendorId}
            onChange={(event) => setSelectedVendorId(event.target.value)}
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-sm"
            aria-label="Pilih vendor"
          >
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name} ({vendor.type}, {vendor.city}){vendor.review ? " ✓" : ""}
              </option>
            ))}
          </select>
          </label>

          <div>
            <span className="mb-1 block text-xs font-bold text-slate-600">Rating</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Rating 1 sampai 5">
              {[5, 4, 3, 2, 1].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-pressed={rating === star}
                  aria-label={`${star} bintang`}
                  className={`h-11 flex-1 rounded-xl border text-lg transition ${
                    rating === star
                      ? "border-amber-400 bg-amber-50"
                      : "border-[var(--border)] bg-white hover:border-amber-200"
                  }`}
                >
                  {"★".repeat(star)}
                  <span className="ml-1 text-xs font-bold text-slate-500">{star}</span>
                </button>
              ))}
            </div>
          </div>
          </>
        ) : (
          <p className="text-sm text-[var(--text-soft)]">Belum ada vendor dalam itinerary ini.</p>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-600">Cerita pengalamanmu</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="min-h-32 w-full rounded-xl border border-[var(--border)] bg-white p-3 text-sm outline-none focus:border-amber-400"
          placeholder="Bagaimana pengalamanmu? Makanan favorit, tips jam kunjungan…"
        />
        </label>

        <button disabled={isSubmitting || !selectedVendorId} className="h-11 w-full rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
          {isSubmitting ? "Menyimpan..." : "Simpan Review (+50 poin)"}
        </button>

        {message ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600" role="status">{message}</p> : null}
        {selected?.review ? (
          <p className="text-[11px] text-emerald-700">✓ Vendor ini sudah kamu ulas — mengirim lagi akan memperbarui ulasanmu.</p>
        ) : null}
      </form>
    </Card>
    </div>
  );
}
