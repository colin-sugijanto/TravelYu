"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { subscribeToFlaggedQueue } from "@/lib/realtime";
import type { FlaggedQueueItem } from "@/types/domain";

interface AdminFlagQueueProps {
  items: FlaggedQueueItem[];
  compact?: boolean;
}

function inferReason(item: FlaggedQueueItem) {
  const payload = item.requested_change ?? {};
  if (typeof payload.reason === "string" && payload.reason.length > 0) return payload.reason;
  if (typeof payload.type === "string" && payload.type.length > 0) return payload.type.replaceAll("_", " ");
  return "Perubahan itinerary butuh approval CS";
}

function inferPriority(item: FlaggedQueueItem): "high" | "medium" {
  const payload = item.requested_change ?? {};
  if (payload.major === true) return "high";
  const type = typeof payload.type === "string" ? payload.type : "";
  if (type.includes("swap") || type.includes("delete")) return "high";
  return "medium";
}

function toneByStatus(status: FlaggedQueueItem["status"]) {
  if (status === "approved") return "brand" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "edited_manual") return "sun" as const;
  return "neutral" as const;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AdminFlagQueue({ items, compact = false }: AdminFlagQueueProps) {
  const router = useRouter();
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Record<string, Pick<FlaggedQueueItem, "status" | "reviewed_at">>
  >({});
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToFlaggedQueue(() => {
      router.refresh();
    });

    return unsubscribe;
  }, [router]);

  const sortedRows = useMemo(() => {
    const merged = items.map((item) =>
      optimisticUpdates[item.id]
        ? {
            ...item,
            ...optimisticUpdates[item.id],
          }
        : item,
    );

    return merged.sort(
      (a, b) => Number(inferPriority(b) === "high") - Number(inferPriority(a) === "high"),
    );
  }, [items, optimisticUpdates]);

  const approve = async (item: FlaggedQueueItem, action: "approve" | "reject" | "edit_manual") => {
    if (actingId) return;

    setActingId(item.id);
    try {
      const response = await fetch(`/api/trip/${encodeURIComponent(item.trip_id)}/flagged/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) return;

      setOptimisticUpdates((prev) => ({
        ...prev,
        [item.id]: {
          status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "edited_manual",
          reviewed_at: new Date().toISOString(),
        },
      }));

      router.refresh();
    } finally {
      setActingId(null);
    }
  };

  return (
    <Card className="p-5">
      <CardTitle>Flagged Items</CardTitle>
      <div className="mt-3 space-y-2">
        {sortedRows.length === 0 ? <CardText>Tidak ada item yang perlu approval.</CardText> : null}

        {sortedRows.slice(0, compact ? 4 : sortedRows.length).map((item) => {
          const priority = inferPriority(item);
          const reason = inferReason(item);

          return (
            <div key={item.id} className="rounded-xl border border-[var(--border)] bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{item.trip_public_id}</p>
                <div className="flex items-center gap-2">
                  <Badge tone={priority === "high" ? "danger" : "sun"}>{priority}</Badge>
                  <Badge tone={toneByStatus(item.status)}>{item.status}</Badge>
                </div>
              </div>
              <CardText className="mt-1">{reason}</CardText>
              <p className="mt-1 text-xs text-[var(--text-soft)]">Item: {item.item_title ?? "General change request"}</p>
              <p className="mt-1 text-xs text-[var(--text-soft)]">Requested at {formatDate(item.created_at)}</p>

              {item.status === "pending" && !compact ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => approve(item, "approve")}
                    disabled={actingId !== null}
                    className="rounded-full bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => approve(item, "edit_manual")}
                    disabled={actingId !== null}
                    className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Edit Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => approve(item, "reject")}
                    disabled={actingId !== null}
                    className="rounded-full bg-[var(--danger)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
