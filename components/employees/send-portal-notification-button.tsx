"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildPortalRequestMessages,
  PORTAL_REQUEST_TOPICS,
  type PortalRequestTopicId,
} from "@/lib/notifications/portal-request-topics";

type SendPortalNotificationButtonProps = {
  employeeId: string;
  employeeName: string;
  workEmail?: string | null;
  personalEmail?: string | null;
  phone?: string | null;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

/** HR action to notify an employee to review their portal */
export function SendPortalNotificationButton({
  employeeId,
  employeeName,
  workEmail,
  personalEmail,
  phone,
  onSuccess,
  onError,
}: SendPortalNotificationButtonProps) {
  const [open, setOpen] = useState(false);
  const [topicId, setTopicId] = useState<PortalRequestTopicId>("GENERAL_REVIEW");
  const [customMessage, setCustomMessage] = useState("");
  const [sendEmail, setSendEmail] = useState(Boolean(workEmail ?? personalEmail));
  const [sendSms, setSendSms] = useState(Boolean(phone));
  const [error, setError] = useState<string | null>(null);

  const hasEmail = Boolean(workEmail ?? personalEmail);
  const hasPhone = Boolean(phone);
  const emailDisplay = workEmail ?? personalEmail ?? null;

  const preview = useMemo(
    () =>
      buildPortalRequestMessages({
        employeeName,
        topicId,
        customMessage,
        appBaseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      }),
    [employeeName, topicId, customMessage]
  );

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/portal-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicId,
          channels: { email: sendEmail, sms: sendSms },
          customMessage: customMessage.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "Failed to send notification");
      }
      return json.message as string;
    },
    onSuccess: (message) => {
      setOpen(false);
      setError(null);
      onSuccess(message);
    },
    onError: (err: Error) => {
      setError(err.message);
      onError(err.message);
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTopicId("GENERAL_REVIEW");
      setCustomMessage("");
      setSendEmail(hasEmail);
      setSendSms(hasPhone);
      setError(null);
    }
  }

  const canSend = (sendEmail || sendSms) && (!sendEmail || hasEmail) && (!sendSms || hasPhone);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Bell className="h-4 w-4 mr-2" />
        Send Notification
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send portal notification</DialogTitle>
            <DialogDescription>
              Notify <strong>{employeeName}</strong> to review their employee portal. An in-app
              notification is always created.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select
                value={topicId}
                onValueChange={(value) => setTopicId(value as PortalRequestTopicId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {PORTAL_REQUEST_TOPICS.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portal-custom-message">Additional message (optional)</Label>
              <Textarea
                id="portal-custom-message"
                placeholder="Add a personal note to the employee (optional)"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                maxLength={500}
                rows={3}
              />
              {customMessage.length > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  {customMessage.length}/500
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label>Send via</Label>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="portal-notif-email"
                  checked={sendEmail}
                  disabled={!hasEmail}
                  onCheckedChange={(checked) => setSendEmail(checked === true)}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="portal-notif-email" className="font-normal cursor-pointer">
                    Email
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {hasEmail ? emailDisplay : "No email on file"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="portal-notif-sms"
                  checked={sendSms}
                  disabled={!hasPhone}
                  onCheckedChange={(checked) => setSendSms(checked === true)}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="portal-notif-sms" className="font-normal cursor-pointer">
                    SMS
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {hasPhone ? phone : "No phone on file"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">In-app notification is always sent.</p>
            </div>

            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                Preview
              </p>
              <p className="whitespace-pre-line">{preview.inAppMessage}</p>
              <p className="text-xs text-muted-foreground break-all">
                Portal: {preview.portalUrl}
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !canSend}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
