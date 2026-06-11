"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  X,
  Check,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  Lock,
  Building2,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MeData = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  phone: string | null;
  personalEmail: string | null;
  workEmail: string | null;
  jobTitle: string | null;
  department: { name: string } | null;
  position: { name: string } | null;
};

function getInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

// ── Contact Info Card ─────────────────────────────────────────────────────────

function ContactCard({ me, onSaved }: { me: MeData; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [preferredName, setPreferredName] = useState(me.preferredName ?? "");
  const [phone, setPhone] = useState(me.phone ?? "");
  const [personalEmail, setPersonalEmail] = useState(me.personalEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function openEdit() {
    setPreferredName(me.preferredName ?? "");
    setPhone(me.phone ?? "");
    setPersonalEmail(me.personalEmail ?? "");
    setError(null);
    setSuccess(false);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredName, phone, personalEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Failed to save");
        return;
      }
      setSuccess(true);
      setEditing(false);
      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          Contact Information
        </CardTitle>
        {!editing && (
          <Button size="sm" variant="outline" onClick={openEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800">
            Profile updated successfully.
          </div>
        )}

        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Preferred Name</Label>
              <Input
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder={`${me.firstName}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Personal Email</Label>
              <Input
                type="email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Work Email (read-only)</Label>
              <Input value={me.workEmail ?? ""} disabled className="bg-muted/50" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                <Check className="h-3.5 w-3.5 mr-1.5" />
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <InfoRow
              icon={<User className="h-4 w-4" />}
              label="Preferred Name"
              value={me.preferredName || `${me.firstName} (not set)`}
            />
            <InfoRow
              icon={<Phone className="h-4 w-4" />}
              label="Phone"
              value={me.phone ?? "Not set"}
            />
            <InfoRow
              icon={<Mail className="h-4 w-4" />}
              label="Personal Email"
              value={me.personalEmail ?? "Not set"}
            />
            <InfoRow
              icon={<Mail className="h-4 w-4 opacity-50" />}
              label="Work Email"
              value={me.workEmail ?? "Not set"}
              muted
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Change Password Card ──────────────────────────────────────────────────────

function ChangePasswordCard() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/employee/me/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Failed to update password");
        return;
      }
      setSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Change Password
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Leave &quot;Current Password&quot; blank if you haven&apos;t set one yet.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            id="old-password"
            label="Current Password"
            value={oldPassword}
            onChange={setOldPassword}
            show={showOld}
            onToggleShow={() => setShowOld((v) => !v)}
            placeholder="Leave blank if no password set"
          />
          <PasswordField
            id="new-password"
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
            placeholder="Min. 6 characters"
          />
          <PasswordField
            id="confirm-password"
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((v) => !v)}
            placeholder="Repeat new password"
          />

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800">
              Password updated successfully.
            </div>
          )}

          <Button type="submit" disabled={saving} className="w-full sm:w-auto">
            {saving ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium truncate ${muted ? "text-muted-foreground" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export function EmployeeProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: me, isLoading } = useQuery<MeData>({
    queryKey: ["employee-me"],
    queryFn: async () => {
      const res = await fetch("/api/employee/me");
      const json = await res.json();
      return json.data;
    },
  });

  function refreshMe() {
    queryClient.invalidateQueries({ queryKey: ["employee-me"] });
  }

  if (isLoading || !me) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  const displayName = me.preferredName
    ? `${me.preferredName} ${me.lastName}`
    : `${me.firstName} ${me.lastName}`;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/employee/dashboard")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <span className="text-sm font-medium text-muted-foreground">/ My Profile</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Avatar + identity block */}
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-primary">
              {getInitials(me.firstName, me.lastName)}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{displayName}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
              {me.jobTitle && (
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {me.jobTitle}
                </span>
              )}
              {me.department && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {me.department.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cards */}
        <ContactCard me={me} onSaved={refreshMe} />
        <ChangePasswordCard />
      </div>
    </div>
  );
}
