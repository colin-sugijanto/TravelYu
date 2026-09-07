import { redirect } from "next/navigation";

import { PlansClient } from "@/components/credits/plans-client";
import { getCurrentAppUser } from "@/lib/auth";
import { getCreditState } from "@/lib/credits";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login?next=%2Fplans");

  const { reason } = await searchParams;
  const state = await getCreditState(appUser.id);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Pilih Paket TravelYu</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Free untuk mencoba · Member untuk traveler rutin · Pro untuk keluarga & kreator. Kredit AI
          terpakai untuk intake, komparasi, generate itinerary, editor, regen hari & parser tiket.
        </p>
        {reason === "trip-limit" ? (
          <p className="mx-auto mt-3 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
            Kamu mencapai batas trip aktif paketmu. Selesaikan trip lama atau upgrade untuk lanjut.
          </p>
        ) : null}
      </div>

      <PlansClient currentTier={state.planTier} balance={state.balance} quota={state.quota} />
    </div>
  );
}
