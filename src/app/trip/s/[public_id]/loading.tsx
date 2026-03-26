export default function SharedTripLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 md:px-6 md:py-8">
      <div className="h-28 rounded-xl bg-[var(--bg-alt)] animate-pulse" />
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-24 rounded-xl bg-[var(--bg-alt)]" />
        ))}
      </div>
    </div>
  );
}
