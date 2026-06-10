"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Dashboard error boundary with recovery steps for dev cache issues */
export default function DashboardError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The admin area failed to load. This often happens when the dev server
          stopped or the Next.js cache was corrupted.
        </p>
        <div className="rounded-md border bg-muted/40 p-4 text-left text-sm space-y-2">
          <p className="font-medium">Try this:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Open the app in your regular browser (not an embedded preview)</li>
            <li>Restart the dev server: <code className="text-xs">npm run dev:clean</code></li>
            <li>Hard refresh the page (Cmd+Shift+R)</li>
          </ol>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/login">Go to login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
