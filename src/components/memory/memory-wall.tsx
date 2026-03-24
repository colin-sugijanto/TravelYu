"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardTitle } from "@/components/ui/card";

interface MemoryPhoto {
  id: string;
  url: string;
  caption: string;
}

interface MemoryWallProps {
  tripId: string;
  initialPhotos?: MemoryPhoto[];
  readOnly?: boolean;
}

export function MemoryWall({ tripId, initialPhotos = [], readOnly = false }: MemoryWallProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState<MemoryPhoto[]>(initialPhotos);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onUpload = async (file: File) => {
    if (isUploading || readOnly) return;

    setIsUploading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("caption", caption);

      const response = await fetch(`/api/trip/${encodeURIComponent(tripId)}/photos`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Gagal upload foto");
        return;
      }

      const list = await fetch(`/api/trip/${encodeURIComponent(tripId)}/photos`);
      const listPayload = await list.json();
      if (list.ok) {
        setPhotos(
          (listPayload.photos ?? [])
            .filter((photo: { publicUrl?: string }) => Boolean(photo.publicUrl))
            .map((photo: { id: string; publicUrl: string; caption: string | null }) => ({
              id: photo.id,
              url: photo.publicUrl,
              caption: photo.caption ?? "",
            })),
        );
      }

      setCaption("");
      router.refresh();
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = async (photoId: string) => {
    if (readOnly) return;

    const response = await fetch(`/api/trip/${encodeURIComponent(tripId)}/photos?photoId=${encodeURIComponent(photoId)}`, {
      method: "DELETE",
    });

    if (!response.ok) return;
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    router.refresh();
  };

  return (
    <Card className="p-5">
      <CardTitle>Memory Wall</CardTitle>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Upload max 20 photos per trip (Supabase Storage bucket: trip-photos)</p>

      {!readOnly ? (
        <div className="mt-4 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-3">
          <input
            type="text"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Caption foto (opsional)"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)]"
          />
          <input
            type="file"
            accept="image/*"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onUpload(file);
              }
              event.currentTarget.value = "";
            }}
            className="block w-full text-sm"
          />
          {errorMessage ? <p className="text-xs text-[var(--danger)]">{errorMessage}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {photos.length === 0 ? <p className="text-sm text-[var(--text-soft)]">Belum ada foto memory wall.</p> : null}

        {photos.map((photo) => (
          <div key={photo.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
            <div className="relative h-36 w-full">
              <Image src={photo.url} alt={photo.caption} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-xs text-[var(--text-soft)]">{photo.caption}</p>
              {!readOnly ? (
                <button type="button" onClick={() => removePhoto(photo.id)} className="text-xs font-semibold text-[var(--danger)]">
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
