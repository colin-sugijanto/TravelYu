export default function FlaggedLoading() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="h-24 rounded-xl bg-[var(--bg-alt)]" />
      ))}
    </div>
  );
}
