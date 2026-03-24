import { AppShell } from "@/components/layout/shell";
import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";

export default function Home() {
  return (
    <AppShell>
      <Hero />
      <FeatureGrid />
    </AppShell>
  );
}
