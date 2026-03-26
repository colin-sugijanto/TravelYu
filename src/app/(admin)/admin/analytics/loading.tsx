export default function AdminAnalyticsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="h-32 rounded-xl bg-[var(--bg-alt)]" />
      ))}
    </div>
  );
}
