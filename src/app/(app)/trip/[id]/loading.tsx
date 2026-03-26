export default function TripLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-28 rounded-xl bg-[var(--bg-alt)]" />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-28 rounded-xl bg-[var(--bg-alt)]" />
          ))}
        </div>

        <div className="space-y-4">
          <div className="h-72 rounded-xl bg-[var(--bg-alt)]" />
          <div className="h-48 rounded-xl bg-[var(--bg-alt)]" />
        </div>
      </div>
    </div>
  );
}
