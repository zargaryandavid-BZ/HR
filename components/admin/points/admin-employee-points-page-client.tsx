"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTable, EmptyState, ErrorMessage, PageHeader } from "@/components/shared/page-header";
import { formatDisplayDate } from "@/lib/dates";
import type { PointTier } from "@/lib/points";

type Violation = {
  id: string; points: number; reason: string; violationType: string | null;
  incidentDate: string; expiresAt: string; isExpired: boolean;
};
type Detail = {
  employee: { id: string; firstName: string; lastName: string; preferredName: string | null; workEmail: string | null; department: string | null; position: string | null };
  summary: { totalActivePoints: number; tier: PointTier; nextExpiry: string | null };
  violations: Violation[];
};
type FormState = { points: string; reason: string; violationType: string; incidentDate: string; expiresAt: string };

const labels: Record<PointTier, string> = { CLEAR: "Clear", WATCH: "Watch", WARNING: "Warning", CRITICAL: "Critical", TERMINATION: "Termination review" };
const emptyForm = (): FormState => ({ points: "", reason: "", violationType: "", incidentDate: new Date().toISOString().slice(0, 10), expiresAt: "" });
const toForm = (v: Violation): FormState => ({ points: String(v.points), reason: v.reason, violationType: v.violationType ?? "", incidentDate: v.incidentDate.slice(0, 10), expiresAt: v.expiresAt.slice(0, 10) });

function TierBadge({ tier }: { tier: PointTier }) {
  return <Badge variant={tier === "CLEAR" ? "success" : tier === "WATCH" ? "secondary" : tier === "WARNING" ? "warning" : "destructive"}>{labels[tier]}</Badge>;
}

/** View and manage an employee's point-violation history. */
export function AdminEmployeePointsPageClient({ employeeId }: { employeeId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Violation | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const detail = useQuery<Detail>({
    queryKey: ["admin-employee-points", employeeId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/points/${employeeId}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "Failed to load employee points");
      return json.data;
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-points"] });
    qc.invalidateQueries({ queryKey: ["admin-employee-points", employeeId] });
  };
  const save = useMutation({
    mutationFn: async () => {
      const payload = { points: Number(form.points), reason: form.reason, violationType: form.violationType || null, incidentDate: form.incidentDate, ...(form.expiresAt ? { expiresAt: form.expiresAt } : {}) };
      const response = await fetch(editing ? `/api/admin/points/${employeeId}/violations/${editing.id}` : `/api/admin/points/${employeeId}`, {
        method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "Unable to save points");
    },
    onSuccess: () => { refresh(); setOpen(false); setEditing(null); setForm(emptyForm()); setFormError(null); },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Unable to save points"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/points/${employeeId}/violations/${id}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message ?? "Unable to delete points");
    },
    onSuccess: refresh,
  });
  function showCreate() { setEditing(null); setForm(emptyForm()); setFormError(null); setOpen(true); }
  function showEdit(violation: Violation) { setEditing(violation); setForm(toForm(violation)); setFormError(null); setOpen(true); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.reason.trim() || Number(form.points) <= 0) { setFormError("A positive point value and reason are required."); return; }
    setFormError(null); save.mutate();
  }
  if (detail.isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">Loading employee points…</p>;
  if (detail.isError || !detail.data) return <div className="space-y-4"><Back /><ErrorMessage message={detail.error?.message ?? "Unable to load employee points"} /></div>;
  const { employee, summary, violations } = detail.data;
  const name = `${employee.preferredName ?? employee.firstName} ${employee.lastName}`;
  return (
    <div className="space-y-6">
      <Back />
      <PageHeader title={`${name}'s Points`} description={[employee.department, employee.position, employee.workEmail].filter(Boolean).join(" · ")} actions={<Button onClick={showCreate}><Plus className="mr-2 h-4 w-4" />Add points</Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Active points"><p className="text-3xl font-bold">{summary.totalActivePoints}</p></Metric>
        <Metric label="Current standing"><div className="mt-2"><TierBadge tier={summary.tier} /></div></Metric>
        <Metric label="Next point expiry"><p className="mt-1 text-lg font-semibold">{summary.nextExpiry ? formatDisplayDate(summary.nextExpiry) : "No active points"}</p></Metric>
      </div>
      {remove.isError && <ErrorMessage message={remove.error instanceof Error ? remove.error.message : "Unable to delete violation"} />}
      {violations.length === 0 ? <EmptyState title="No point violations" description="Add a violation to begin tracking this employee's point balance." action={<Button onClick={showCreate}>Add points</Button>} /> : (
        <DataTable>
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Incident</th><th className="px-4 py-3">Points</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Expires</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="divide-y">{violations.map((v) => <tr key={v.id} className={v.isExpired ? "bg-muted/20 text-muted-foreground" : ""}>
            <td className="px-4 py-3">{formatDisplayDate(v.incidentDate)}</td><td className="px-4 py-3 font-semibold">{v.points}</td>
            <td className="px-4 py-3"><p className="font-medium">{v.reason}</p>{v.violationType && <p className="text-xs text-muted-foreground">{v.violationType}</p>}</td>
            <td className="px-4 py-3">{formatDisplayDate(v.expiresAt)}</td><td className="px-4 py-3"><Badge variant={v.isExpired ? "secondary" : "success"}>{v.isExpired ? "Expired" : "Active"}</Badge></td>
            <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => showEdit(v)}><Pencil className="h-4 w-4" /><span className="sr-only">Edit</span></Button><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={remove.isPending} onClick={() => window.confirm(`Delete this ${v.points}-point violation?`) && remove.mutate(v.id)}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete</span></Button></div></td>
          </tr>)}</tbody>
        </DataTable>
      )}
      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setFormError(null); }}>
        <DialogContent><DialogHeader><DialogTitle>{editing ? "Edit point violation" : "Add point violation"}</DialogTitle><DialogDescription>Points expire one year after the incident unless you specify another expiry date.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Points"><Input type="number" min="0.1" step="0.1" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} required /></Field><Field label="Violation type"><Input value={form.violationType} placeholder="e.g. Attendance" onChange={(e) => setForm({ ...form, violationType: e.target.value })} /></Field><Field label="Incident date"><Input type="date" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} required /></Field><Field label="Expiry date"><Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></Field></div>
            <Field label="Reason"><textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required /></Field>
            {formError && <ErrorMessage message={formError} />}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Add points"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Back() { return <Button asChild variant="ghost" size="sm"><Link href="/admin/points"><ArrowLeft className="mr-2 h-4 w-4" />Back to points</Link></Button>; }
function Metric({ label, children }: { label: string; children: React.ReactNode }) { return <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p>{children}</CardContent></Card>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1 text-sm font-medium">{label}{children}</label>; }
