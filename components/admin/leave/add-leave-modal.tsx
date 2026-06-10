"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn, formatLeaveBalanceValue } from "@/lib/utils";

const schema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  note: z.string().optional(),
  autoApprove: z.boolean(),
});

type FormData = z.infer<typeof schema>;

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  department: { name: string } | null;
  avatarInitials: string;
};

type LeaveType = { id: string; name: string; defaultDays: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

/** Modal for HR to manually add a leave request on behalf of an employee */
export function AddLeaveModal({ open, onOpenChange, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [workingDays, setWorkingDays] = useState<number | null>(null);
  const [balanceInfo, setBalanceInfo] = useState<{ remaining: number; total: number } | null>(null);
  const [calculatingDays, setCalculatingDays] = useState(false);

  const { control, register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: { autoApprove: true, employeeId: "", leaveTypeId: "", startDate: "", endDate: "" },
  });

  const watchedEmployeeId = watch("employeeId");
  const watchedLeaveTypeId = watch("leaveTypeId");
  const watchedStart = watch("startDate");
  const watchedEnd = watch("endDate");

  const { data: employeesData } = useQuery({
    queryKey: ["employees-search", employeeSearch],
    queryFn: async () => {
      const params = employeeSearch ? `?search=${encodeURIComponent(employeeSearch)}` : "";
      const res = await fetch(`/api/employees${params}`);
      const json = await res.json();
      return (json.data?.employees ?? []) as Employee[];
    },
    staleTime: 30_000,
  });

  const { data: leaveTypesData } = useQuery({
    queryKey: ["leave-types-active"],
    queryFn: async () => {
      const res = await fetch("/api/settings/leave-types");
      const json = await res.json();
      return (json.data ?? []) as LeaveType[];
    },
    staleTime: 60_000,
  });

  const { data: balancesData } = useQuery({
    queryKey: ["employee-balances", watchedEmployeeId],
    queryFn: async () => {
      const res = await fetch(`/api/leave/balances`);
      const json = await res.json();
      const emp = (json.data?.employees ?? []).find((e: { id: string }) => e.id === watchedEmployeeId);
      return emp?.balances as Record<string, { allowance: number; usedDays: number; remainingDays: number }> | undefined;
    },
    enabled: !!watchedEmployeeId,
    staleTime: 30_000,
  });

  // Calculate working days when dates change
  useEffect(() => {
    if (!watchedStart || !watchedEnd) { setWorkingDays(null); return; }
    const start = new Date(watchedStart);
    const end = new Date(watchedEnd);
    if (end < start) { setWorkingDays(0); return; }

    setCalculatingDays(true);
    const url = `/api/leave/requests?employeeId=${watchedEmployeeId}&startDate=${watchedStart}&endDate=${watchedEnd}&calculateOnly=true`;
    // For working day preview, do a lightweight calculation client-side
    let count = 0;
    const curr = new Date(start);
    while (curr <= end) {
      const day = curr.getDay();
      if (day !== 0 && day !== 6) count++;
      curr.setDate(curr.getDate() + 1);
    }
    setWorkingDays(count);
    setCalculatingDays(false);
  }, [watchedStart, watchedEnd, watchedEmployeeId]);

  // Update balance preview when leave type or employee changes
  useEffect(() => {
    if (!watchedLeaveTypeId || !balancesData) { setBalanceInfo(null); return; }
    const b = balancesData[watchedLeaveTypeId];
    if (b) setBalanceInfo({ remaining: b.remainingDays, total: b.allowance });
    else setBalanceInfo(null);
  }, [watchedLeaveTypeId, balancesData]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/leave/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: data.employeeId,
          leaveTypeId: data.leaveTypeId,
          startDate: data.startDate,
          endDate: data.endDate,
          note: data.note,
          autoApprove: data.autoApprove,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.message ?? "Failed to create leave request");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Leave request created");
      queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["leave-stats"] });
      reset();
      setWorkingDays(null);
      setBalanceInfo(null);
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const exceedsBalance =
    balanceInfo !== null &&
    workingDays !== null &&
    workingDays > balanceInfo.remaining;

  const afterBalance =
    balanceInfo !== null && workingDays !== null
      ? balanceInfo.remaining - workingDays
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Leave Request</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d as FormData))} className="space-y-4">
          {/* Employee */}
          <div className="space-y-1.5">
            <Label htmlFor="employee-search">Employee</Label>
            <Input
              id="employee-search"
              placeholder="Search by name…"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="mb-1"
            />
            <Controller
              name="employeeId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {(employeesData ?? []).map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                        {emp.department && <span className="text-muted-foreground ml-1 text-xs">· {emp.department.name}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
          </div>

          {/* Leave Type */}
          <div className="space-y-1.5">
            <Label>Leave Type</Label>
            <Controller
              name="leaveTypeId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(leaveTypesData ?? []).map((lt) => {
                      const bal = balancesData?.[lt.id];
                      const remaining = bal?.remainingDays ?? lt.defaultDays;
                      return (
                        <SelectItem key={lt.id} value={lt.id}>
                          {lt.name}
                          <span className="text-muted-foreground ml-1 text-xs">— {formatLeaveBalanceValue(remaining)} days remaining</span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.leaveTypeId && <p className="text-xs text-destructive">{errors.leaveTypeId.message}</p>}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" {...register("endDate")} />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
            </div>
          </div>

          {/* Working days preview */}
          {workingDays !== null && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm space-y-1">
              <p>
                {calculatingDays ? "Calculating…" : (
                  <><span className="font-semibold">{workingDays}</span> working {workingDays === 1 ? "day" : "days"}</>
                )}
              </p>
              {balanceInfo !== null && afterBalance !== null && (
                <p className={cn("text-xs", afterBalance < 0 ? "text-red-600" : "text-muted-foreground")}>
                  After this request: <span className="font-medium">{formatLeaveBalanceValue(afterBalance)}</span> of {formatLeaveBalanceValue(balanceInfo.total)} days remaining
                </p>
              )}
            </div>
          )}

          {/* Exceeds balance warning */}
          {exceedsBalance && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>This exceeds the employee&apos;s remaining balance. HR can override this.</span>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea id="note" {...register("note")} rows={2} placeholder="Optional note for this request…" className="resize-none" />
          </div>

          {/* Auto-approve */}
          <div className="flex items-center gap-2">
            <Controller
              name="autoApprove"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="autoApprove"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="autoApprove" className="font-normal cursor-pointer">
              Approve immediately
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
