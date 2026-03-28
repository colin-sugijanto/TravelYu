"use client";

import { useEffect, useState } from "react";
import { Info, MapPin, X, Star, Link as LinkIcon, Phone } from "lucide-react";

interface VendorData {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  whatsapp_number: string | null;
  ig_handle: string | null;
  price_tier: "$" | "$$" | "$$$" | null;
  rating: number | null;
  is_verified: boolean;
  notes_for_ai: string | null;
}

export function VendorModal({
  vendorId,
  tripId,
}: {
  vendorId: string | null;
  tripId: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<VendorData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = () => {
    if (!data) {
      setLoading(true);
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open || !vendorId || data) return;
    let isMounted = true;

    fetch(`/api/vendor/${vendorId}?tripId=${encodeURIComponent(tripId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.vendor) {
          setData(json.vendor);
        }
        if (isMounted) setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, vendorId, data, tripId]);

  if (!vendorId) return null;

  return (
    <>
      <button
        onClick={handleOpen}
        className="ml-1.5 inline-flex items-center gap-1 hover:opacity-80"
      >
        <span className="rounded-full bg-emerald-50 px-1.5 text-[10px] uppercase font-bold tracking-wider text-emerald-700 border border-emerald-200">
          Verified
        </span>
        <Info className="w-3.5 h-3.5 text-emerald-600" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 hover:bg-zinc-100 transition-colors"
            >
              <X className="w-4 h-4 text-zinc-500" />
            </button>

            {loading ? (
              <div className="py-8 text-center text-zinc-500 text-sm animate-pulse">
                Memuat data vendor...
              </div>
            ) : data ? (
              <div className="space-y-4 pt-2 text-left">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 pr-8">{data.name}</h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-600">
                    <span className="uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-sm">
                      {data.type}
                    </span>
                    {data.price_tier && (
                      <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-sm">
                        {data.price_tier}
                      </span>
                    )}
                    {data.rating && (
                      <span className="flex items-center gap-0.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-sm">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {data.rating}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 text-sm text-zinc-700 pt-2 border-t border-zinc-100">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                    <span>{data.address ?? data.city}</span>
                  </div>

                  {(data.whatsapp_number || data.ig_handle) && (
                    <div className="flex flex-col gap-2.5 pt-1">
                      {data.whatsapp_number && (
                        <div className="flex items-center gap-2.5">
                          <Phone className="w-4 h-4 text-zinc-400 shrink-0" />
                          <a href={`https://wa.me/${data.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">
                            {data.whatsapp_number}
                          </a>
                        </div>
                      )}
                      {data.ig_handle && (
                        <div className="flex items-center gap-2.5">
                          <LinkIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                          <a href={`https://instagram.com/${data.ig_handle.replace("@", "")}`} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">
                            {data.ig_handle.startsWith("@") ? data.ig_handle : `@${data.ig_handle}`}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {data.notes_for_ai && (
                    <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs italic text-zinc-600 border border-zinc-100">
                      📝 &quot;{data.notes_for_ai}&quot;
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-red-500 text-sm">
                Vendor tidak ditemukan
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
