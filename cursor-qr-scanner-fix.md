# Cursor Prompt — Fix QR Scanner Camera Not Working

## Problem

`/admin/clock/scanner` loads but the camera never activates. The page shows a blank container with no video feed.

## Root Cause

The current implementation uses `Html5QrcodeScanner` from `html5-qrcode`. This class renders its own internal "Start Scanning" button inside the DOM container — it **waits for a user click** before requesting camera access. That button is invisible because it renders raw HTML that conflicts with Tailwind/dark container styles.

## Fix

Replace `Html5QrcodeScanner` with `Html5Qrcode` (the lower-level class from the same package). This lets us call `.start()` directly in `useEffect`, which auto-activates the camera on page load without any button click.

## File to change

`components/timesheet/qr-scanner-client.tsx`

## Exact changes

1. Change the dynamic import from:
   ```ts
   const { Html5QrcodeScanner } = await import("html5-qrcode");
   ```
   to:
   ```ts
   const { Html5Qrcode } = await import("html5-qrcode");
   ```

2. Replace the `Html5QrcodeScanner` instantiation and `.render()` call with:
   ```ts
   const qrScanner = new Html5Qrcode(containerId);

   await qrScanner.start(
     { facingMode: { ideal: "environment" } },
     { fps: 10, qrbox: { width: 250, height: 250 } },
     async (decodedText) => {
       // existing scan handler logic here (debounce, fetch /api/admin/clock/scan, setResult, etc.)
     },
     undefined // ignore per-frame decode failures
   );
   ```

   Key notes:
   - `{ facingMode: { ideal: "environment" } }` — prefers back camera on mobile, falls back to any camera on desktop. Do NOT use `facingMode: "environment"` (exact match) — it fails on desktops with no back camera.
   - The 4th argument `undefined` suppresses noisy per-frame "no QR found" errors in the console.

3. For cleanup, change the ref type and teardown:
   ```ts
   const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

   // after start() succeeds:
   scannerRef.current = qrScanner;

   // in useEffect cleanup:
   return () => {
     stopped = true;
     if (scannerRef.current) {
       scannerRef.current.stop().catch(() => {});
       scannerRef.current = null;
     }
   };
   ```

4. Add a `cameraStatus` state (`"requesting" | "active" | "denied" | "error"`) and show appropriate UI:
   - **requesting** — spinner + "Requesting camera access…"
   - **active** — show the scanner `<div>` (set after `.start()` resolves)
   - **denied** — "Camera access denied. Allow permissions in browser settings and reload."
   - **error** — "Could not start camera. Make sure no other app is using the camera, then reload."

   Detect denied vs error by checking `err.message.toLowerCase().includes("permission")` or `"denied"` in the catch block.

5. The scanner container `<div>` must always be present in the DOM (html5-qrcode needs the element to exist before `.start()` is called). Hide it with `className="hidden"` when status is not `"active"`, rather than conditionally rendering it.

## Full component structure

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

type CameraStatus = "requesting" | "active" | "denied" | "error";

export function QrScannerClient() {
  const containerId = "qr-scanner-container";
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const debounceRef = useRef(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("requesting");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return;

        const scanner = new Html5Qrcode(containerId);
        await scanner.start(
          { facingMode: { ideal: "environment" } },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            if (debounceRef.current) return;
            debounceRef.current = true;
            // ... call /api/admin/clock/scan, setResult, 3s timeout, reset debounce
          },
          undefined
        );

        if (stopped) { await scanner.stop().catch(() => {}); return; }
        scannerRef.current = scanner;
        setCameraStatus("active");
      } catch (err) {
        if (stopped) return;
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        setCameraStatus(msg.includes("permission") || msg.includes("denied") ? "denied" : "error");
      }
    }

    start();
    return () => {
      stopped = true;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, []);

  return (
    <div className="max-w-lg mx-auto">
      {/* PageHeader */}
      {/* result card (green for CLOCKED_IN, blue for CLOCKED_OUT) */}
      {/* error card */}
      {cameraStatus === "requesting" && <Spinner />}
      {cameraStatus === "denied" && <PermissionError />}
      {cameraStatus === "error" && <CameraError />}
      <div
        id={containerId}
        className={`rounded-lg overflow-hidden border bg-black min-h-[320px] ${cameraStatus !== "active" ? "hidden" : ""}`}
      />
    </div>
  );
}
```

## No other files need to change

Only `components/timesheet/qr-scanner-client.tsx`. The API route, page, and all other files are fine as-is.
