"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/utils";
import type { TripExpense } from "@/types/domain";

interface ExpenseSplitProps {
  tripId: string;
  canEdit?: boolean;
  memberCount?: number;
}

/**
 * Group expense split — "patungan" tracker with settle-up summary.
 * Equal split among `memberCount` (owner + group members, min 1).
 * Mobile-first: stacked form, desktop inline.
 */
export function ExpenseSplit({ tripId, canEdit = true, memberCount = 1 }: ExpenseSplitProps) {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}/expenses`);
      if (!res.ok) return;
      const payload = (await res.json()) as { expenses?: TripExpense[] };
      setExpenses(payload.expenses ?? []);
    } catch {
      // ignore until migration 017 applied
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const { total, perPerson, byPayer } = useMemo(() => {
    const t = expenses.reduce((s, e) => s + (e.amount_idr ?? 0), 0);
    const split = Math.max(1, memberCount);
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.paid_by, (map.get(e.paid_by) ?? 0) + e.amount_idr);
    return { total: t, perPerson: split > 0 ? Math.round(t / split) : t, byPayer: [...map.entries()].sort((a, b) => b[1] - a[1]) };
  }, [expenses, memberCount]);

  const add = async () => {
    const cleanAmount = Number(String(amount).replace(/[^0-9]/g, ""));
    if (!title.trim() || !cleanAmount || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/trip/${encodeURIComponent(tripId)}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), amount_idr: cleanAmount, paid_by: paidBy.trim() || "Saya" }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        setMessage(payload.error ?? "Gagal menyimpan pengeluaran.");
        return;
      }
      setTitle("");
      setAmount("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (expenseId: string) => {
    const res = await fetch(
      `/api/trip/${encodeURIComponent(tripId)}/expenses?expenseId=${encodeURIComponent(expenseId)}`,
      { method: "DELETE" },
    );
    if (res.ok) await load();
  };

  return (
    <Card className="p-5">
      <CardTitle>🧾 Patungan & Settle-up</CardTitle>
      <p className="mt-1 text-xs text-zinc-500">
        Catat siapa bayar apa selama trip. Total dibagi rata ke {memberCount} orang → {formatIdr(perPerson)}/orang.
      </p>

      <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-[13px] sm:grid-cols-3">
        <div>
          <p className="text-[11px] text-zinc-500">Total patungan</p>
          <p className="font-extrabold">{formatIdr(total)}</p>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500">Per orang</p>
          <p className="font-extrabold text-amber-700">{expenses.length > 0 ? formatIdr(perPerson) : "—"}</p>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500">Transaksi</p>
          <p className="font-extrabold">{expenses.length}</p>
        </div>
      </div>

      {byPayer.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {byPayer.map(([name, sum]) => (
            <span key={name} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
              {name}: {formatIdr(sum)}
            </span>
          ))}
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_110px_auto]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="cth: Sewa mobil Day 2"
            className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-amber-400"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Rp …"
            inputMode="numeric"
            className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-amber-400"
          />
          <input
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            placeholder="Dibayar: Saya"
            className="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || !title.trim()}
            className="h-10 rounded-full bg-zinc-900 px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? "…" : "+ Tambah"}
          </button>
        </div>
      ) : null}

      {message ? <p className="mt-2 text-xs text-red-500">{message}</p> : null}

      <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-bold">{e.title}</p>
              <p className="text-[11px] text-zinc-500">dibayar {e.paid_by} · {formatIdr(e.amount_idr)}</p>
            </div>
            {canEdit ? (
              <button type="button" onClick={() => remove(e.id)} className="shrink-0 text-[11px] font-semibold text-red-500">
                Hapus
              </button>
            ) : null}
          </div>
        ))}
        {expenses.length === 0 ? <p className="text-xs text-zinc-400">Belum ada pengeluaran patungan.</p> : null}
      </div>
    </Card>
  );
}
