import { Card, CardText, CardTitle } from "@/components/ui/card";
import { getWhatsappLogs } from "@/lib/data";

export default async function AdminWhatsappPage() {
  const logs = await getWhatsappLogs(100);

  return (
    <Card className="p-5">
      <CardTitle>WhatsApp Center</CardTitle>
      <CardText className="mt-1">Audit log outgoing/incoming WA messages dari n8n Evolution workflow.</CardText>

      <div className="mt-3 space-y-2">
        {logs.length === 0 ? <CardText>Belum ada log WhatsApp.</CardText> : null}

        {logs.map((entry, idx) => (
          <div key={`${entry.recipient_id}-${idx}`} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {entry.recipient_type}:{entry.recipient_id}
              </span>
              <span className="text-[var(--text-soft)]">{entry.status}</span>
            </div>
            <p className="text-xs text-[var(--text-soft)]">{entry.message}</p>
            <p className="text-[11px] text-[var(--text-soft)]">{new Date(entry.created_at).toLocaleString("id-ID")}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
