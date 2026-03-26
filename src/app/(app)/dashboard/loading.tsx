export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="h-40 rounded-xl bg-[var(--bg-alt)]" />
        <div className="h-40 rounded-xl bg-[var(--bg-alt)]" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="h-14 rounded-xl bg-[var(--bg-alt)]" />
        ))}
      </div>
    </div>
  );
}
