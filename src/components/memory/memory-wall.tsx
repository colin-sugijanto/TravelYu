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
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshList = async () => {
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
  };

  const onUploadFiles = async (files: FileList | File[]) => {    if (isUploading || readOnly) return;
    const queue = Array.from(files).slice(0, 5);
    if (queue.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);
    try {
      for (let i = 0; i < queue.length; i += 1) {
        const file = queue[i];
        setUploadProgress(`Mengunggah ${i + 1}/${queue.length}…`);
        const formData = new FormData();
        formData.append("file", file);
        // Caption only applies to single uploads; batch uploads keep filenames.
        formData.append("caption", queue.length === 1 ? caption : "");

        const response = await fetch(`/api/trip/${encodeURIComponent(tripId)}/photos`, {
          method: "POST",
          body: formData,
        });

        const payload = await response.json();
        if (!response.ok) {
          setErrorMessage(payload.error ?? `Gagal upload foto ${i + 1}`);
          break;
        }
      }

      await refreshList();
      setCaption("");
      router.refresh();
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const removePhoto = async (photoId: string) => {
    if (readOnly) return;
    const confirmed = window.confirm("Hapus foto ini dari memory wall?");
    if (!confirmed) return;

    const response = await fetch(`/api/trip/${encodeURIComponent(tripId)}/photos?photoId=${encodeURIComponent(photoId)}`, {
      method: "DELETE",
    });

    if (!response.ok) return;
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    router.refresh();
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>📷 Memory Wall</CardTitle>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {photos.length}/20 foto
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Upload hingga 5 foto sekaligus. +10 poin per foto (maks 20 foto/trip).</p>

      {!readOnly ? (
        <div className="mt-4 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-alt)] p-3">
          <input
            type="text"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Caption foto (khusus upload 1 foto)"
            aria-label="Caption foto"
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)]"
          />
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isUploading}
            onChange={(event) => {
              const files = event.target.files;
              if (files && files.length > 0) {
                void onUploadFiles(files);
              }
              event.currentTarget.value = "";
            }}
            className="block w-full text-sm"
            aria-label="Pilih foto untuk diunggah"
          />
          {uploadProgress ? <p className="text-xs font-semibold text-blue-700">{uploadProgress}</p> : null}
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
