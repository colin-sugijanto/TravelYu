export default function CompareLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="h-80 rounded-xl bg-[var(--bg-alt)]" />
        ))}
      </div>

      <div className="h-40 rounded-xl bg-[var(--bg-alt)]" />
    </div>
  );
}
