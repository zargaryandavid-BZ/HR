"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

/** Redirect employee to their active onboarding instance */
export default function EmployeeOnboardingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const res = await fetch("/api/onboarding/instances/active");
      const json = await res.json();
      if (json.data?.id) {
        router.replace(`/employee/onboarding/${json.data.id}`);
      } else {
        router.replace("/employee/dashboard");
      }
    }
    void redirect();
  }, [router]);

  return <Skeleton className="h-48 w-full" />;
}
