"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type CopyEmployeePortalLinkButtonProps = {
  employeeId: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

/** Copy a one-time link that opens this employee's portal dashboard directly */
export function CopyEmployeePortalLinkButton({
  employeeId,
  onSuccess,
  onError,
}: CopyEmployeePortalLinkButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleCopy() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/employee/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to create portal link");
      }

      const path = json.data?.url as string | undefined;
      if (!path) throw new Error("Failed to create portal link");

      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      onSuccess(
        "Employee portal link copied — opens their dashboard directly (expires in 5 minutes)"
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to copy portal link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      title="Copy direct link to this employee's portal dashboard"
      aria-label="Copy direct link to this employee's portal dashboard"
      disabled={loading}
      onClick={handleCopy}
    >
      <Link2 className="h-4 w-4" />
    </Button>
  );
}
