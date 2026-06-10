"use client";

import { cn } from "@/lib/utils";

type ToastBannerProps = {
  message: string | null;
  variant?: "default" | "success" | "error";
};

/** Simple fixed toast banner */
export function ToastBanner({ message, variant = "default" }: ToastBannerProps) {
  if (!message) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 rounded-md border px-4 py-3 text-sm shadow-lg",
        variant === "success" && "border-green-200 bg-green-50 text-green-900",
        variant === "error" && "border-red-200 bg-red-50 text-red-900",
        variant === "default" && "border-border bg-background"
      )}
    >
      {message}
    </div>
  );
}
