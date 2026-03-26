export default function AdminWhatsappLoading() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div key={idx} className="h-16 rounded-xl bg-[var(--bg-alt)]" />
      ))}
    </div>
  );
}
