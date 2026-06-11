"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Mail, Phone, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";

type MeData = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  phone?: string | null;
  personalEmail?: string | null;
  workEmail?: string | null;
  jobTitle?: string | null;
  employeeNumber?: string | null;
  department?: { name: string } | null;
};

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-input bg-white px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function EmployeeProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // ── Profile state ────────────────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false);
  const [preferredName, setPreferredName] = useState("");
  const [phone, setPhone] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Password state ───────────────────────────────────────────────────
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: me, isLoading } = useQuery<MeData>({
    queryKey: ["employee-me"],
    queryFn: async () => {
      const res = await fetch("/api/employee/me");
      const json = await res.json();
      return json.data;
    },
  });

  function startEditing() {
    setPreferredName(me?.preferredName ?? "");
    setPhone(me?.phone ?? "");
    setPersonalEmail(me?.personalEmail ?? "");
    setEditingProfile(true);
    setProfileMsg(null);
  }

  function cancelEditing() {
    setEditingProfile(false);
    setProfileMsg(null);
  }

  async function saveProfile() {
    setProfileLoading(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/employee/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredName: preferredName || null, phone: phone || null, personalEmail: personalEmail || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setProfileMsg({ type: "error", text: json.message ?? "Failed to save" });
      } else {
        setProfileMsg({ type: "success", text: "Profile updated" });
        setEditingProfile(false);
        queryClient.invalidateQueries({ queryKey: ["employee-me"] });
      }
    } catch {
      setProfileMsg({ type: "error", text: "Network error" });
    } finally {
      setProfileLoading(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 6) {
      setPwMsg({ type: "error", text: "New password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: "New passwords do not match" });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/employee/me/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPwMsg({ type: "error", text: json.message ?? "Failed to change password" });
      } else {
        setPwMsg({ type: "success", text: "Password changed successfully" });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPwMsg({ type: "error", text: "Network error" });
    } finally {
      setPwLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fullName = me ? `${me.preferredName ?? me.firstName} ${me.lastName}` : "";
  const initials = me ? `${me.firstName[0]}${me.lastName[0]}`.toUpperCase() : "?";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50">
      {/* Top bar */}
      <header className="z-40 shrink-0 border-b bg-white h-14 flex items-center px-4 gap-3 shadow-sm">
        <button
          onClick={() => router.push("/employee/dashboard")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </button>
        <div className="flex-1" />
        <span className="text-sm font-semibold text-slate-700">My Profile</span>
        <div className="flex-1" />
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto space-y-4">

          {/* Avatar + name card */}
          <Card>
            <CardContent className="py-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-base font-semibold text-slate-800">{fullName}</p>
                <p className="text-sm text-slate-500">{me?.jobTitle ?? "—"}</p>
                {me?.department && (
                  <p className="text-xs text-slate-400">{typeof me.department === "object" ? me.department.name : me.department}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact info */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Contact Information
              </CardTitle>
              {!editingProfile && (
                <button onClick={startEditing} className="text-xs text-primary hover:underline">
                  Edit
                </button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {editingProfile ? (
                <>
                  <InputField label="Preferred Name" value={preferredName} onChange={setPreferredName} placeholder={`${me?.firstName}`} />
                  <InputField label="Phone" value={phone} onChange={setPhone} type="tel" placeholder="+1 (555) 000-0000" />
                  <InputField label="Personal Email" value={personalEmail} onChange={setPersonalEmail} type="email" placeholder="you@example.com" />
                  {me?.workEmail && (
                    <InputField label="Work Email" value={me.workEmail} onChange={() => {}} disabled placeholder="" />
                  )}
                  {profileMsg && (
                    <p className={`text-xs ${profileMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>
                      {profileMsg.text}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={saveProfile} disabled={profileLoading} className="flex-1">
                      {profileLoading ? "Saving…" : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEditing} disabled={profileLoading} className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700">{me?.phone ?? <span className="text-slate-400 italic">No phone on file</span>}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700">{me?.personalEmail ?? <span className="text-slate-400 italic">No personal email</span>}</p>
                      {me?.workEmail && <p className="text-xs text-slate-400">{me.workEmail} (work)</p>}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change password */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> Change Password
              </CardTitle>
              <p className="text-xs text-slate-400">Leave blank old password if you haven&apos;t set one yet</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={changePassword} className="space-y-3">
                <PasswordField label="Current Password" value={oldPassword} onChange={setOldPassword} placeholder="Enter current password" />
                <PasswordField label="New Password" value={newPassword} onChange={setNewPassword} placeholder="Min. 6 characters" />
                <PasswordField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat new password" />

                {pwMsg && (
                  <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                    pwMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}>
                    {pwMsg.type === "success" && <CheckCircle className="h-3.5 w-3.5 shrink-0" />}
                    {pwMsg.text}
                  </div>
                )}

                <Button type="submit" size="sm" className="w-full" disabled={pwLoading}>
                  {pwLoading ? "Updating…" : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
