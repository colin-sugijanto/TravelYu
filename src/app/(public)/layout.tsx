import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/shell";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
