import { SignIn } from "@clerk/nextjs";

import { Card, CardText, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/dashboard";

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6 shadow-[0_22px_42px_-30px_rgba(15,23,42,0.4)]">
        <CardTitle className="text-xl">Login ke TravelYu</CardTitle>
        <CardText className="mt-1">Gunakan akun Google atau email untuk lanjut.</CardText>

        <div className="mt-4">
          <SignIn
            path="/login"
            routing="path"
            forceRedirectUrl={nextPath}
            fallbackRedirectUrl={nextPath}
            appearance={{
              elements: {
                card: "shadow-none border-0 p-0",
                rootBox: "w-full",
                header: "hidden",
              },
            }}
          />
        </div>
      </Card>
    </div>
  );
}
