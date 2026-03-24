import { CSChatPanel } from "@/components/admin/cs-chat-panel";
import { getOpenChatSessions } from "@/lib/data";

export default async function AdminChatPage() {
  const sessions = await getOpenChatSessions(100);
  return <CSChatPanel initialSessions={sessions} />;
}
