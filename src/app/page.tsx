import { Button } from "@/components/ui/button";
import { AuthStatusAction } from "./AuthStatusAction";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-6 py-24 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,var(--color-muted)_0%,transparent_60%)]" />

      <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
        Frontend foundation
      </span>

      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
        Cotople
      </h1>

      <p className="max-w-md text-balance text-lg text-muted-foreground">
        Frontend foundation is up and running.
      </p>

      <div className="mt-2 flex items-center gap-3">
        <AuthStatusAction />
        <Button size="lg" variant="outline" className="h-auto px-8 py-3">
          Learn More
        </Button>
      </div>
    </main>
  );
}
