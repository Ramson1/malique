"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Analytics is now merged into the unified Dashboard (Phase 1). Keep the
// route so any bookmarked / external links resolve, but forward to /dashboard.
export default function AnalyticsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin" />
      Redirecting to Dashboard…
    </div>
  );
}
