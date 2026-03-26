export default function AdminLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-28 rounded-xl bg-[var(--bg-alt)]" />
        ))}
      </div>

      <div className="h-80 rounded-xl bg-[var(--bg-alt)]" />
    </div>
  );
}
