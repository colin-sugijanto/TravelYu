"use client";

import { useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";

interface PackingItem {
  item: string;
  category: string;
  checked: boolean;
}

export function PackingList({ initialItems }: { initialItems: PackingItem[] }) {
  const [items, setItems] = useState<PackingItem[]>(initialItems);

  return (
    <Card className="p-5">
      <CardTitle>Packing List</CardTitle>
      <div className="mt-3 space-y-2">
        {items.map((entry, idx) => (
          <label key={`${entry.item}-${idx}`} className="flex items-center justify-between rounded-lg bg-[var(--bg-alt)] px-3 py-2 text-sm">
            <span>{entry.item}</span>
            <input
              type="checkbox"
              checked={entry.checked}
              onChange={(event) => {
                setItems((prev) =>
                  prev.map((row, rowIdx) => {
                    if (rowIdx !== idx) return row;
                    return { ...row, checked: event.target.checked };
                  }),
                );
              }}
            />
          </label>
        ))}
      </div>
    </Card>
  );
}
