import { AppShell } from "@/components/layout/shell";
import { Hero } from "@/components/marketing/hero";
import { Highlights } from "@/components/marketing/highlights";
import { Culture } from "@/components/marketing/culture";
import { Plan } from "@/components/marketing/plan";
import { HiddenGems } from "@/components/marketing/hidden-gems";
import { Newsletter } from "@/components/marketing/newsletter";
import { Footer } from "@/components/layout/footer";

export default function Home() {
  return (
    <AppShell noPadding>
      <div className="min-h-screen">
        <Hero />
        <Highlights />
        <Culture />
        <Plan />
        <HiddenGems />
        <Newsletter />
        <Footer />
      </div>
    </AppShell>
  );
}
