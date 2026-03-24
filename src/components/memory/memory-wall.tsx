"use client";

import Image from "next/image";
import { useState } from "react";

import { Card, CardTitle } from "@/components/ui/card";

interface MemoryPhoto {
  id: string;
  url: string;
  caption: string;
}

const samplePhotos: MemoryPhoto[] = [
  { id: "1", url: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", caption: "Sunrise Ubud" },
  { id: "2", url: "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600&q=80", caption: "Beach walk" },
  { id: "3", url: "https://images.unsplash.com/photo-1518544866330-95f7aeaf6f58?w=600&q=80", caption: "Family dinner" },
];

export function MemoryWall() {
  const [photos] = useState<MemoryPhoto[]>(samplePhotos);

  return (
    <Card className="p-5">
      <CardTitle>Memory Wall</CardTitle>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Upload max 20 photos per trip (Supabase Storage bucket: trip-photos)</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => (
          <div key={photo.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            <div className="relative h-36 w-full">
              <Image src={photo.url} alt={photo.caption} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
            </div>
            <p className="px-3 py-2 text-xs text-[var(--text-soft)]">{photo.caption}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
