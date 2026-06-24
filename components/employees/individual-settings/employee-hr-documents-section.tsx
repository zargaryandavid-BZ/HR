"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";
import { Download, Eye, MoreHorizontal, RefreshCw, Send } from "lucide-react";
import type { GeneratedDocumentItem } from "@/lib/individual-settings/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

type EmployeeHrDocumentsSectionProps = {
  employeeId: string;
  mode?: "admin" | "employee";
  onToast?: (message: string) => void;
};

const HR_DOC_TYPES = [
  { type: "OFFER_LETTER" as const, title: "Offer Letter" },
  { type: "WELCOME_EMAIL" as const, title: "Welcome Email" },
];

/** Auto-generated HR documents and send-for-signature section */
export function EmployeeHrDocumentsSection({
  employeeId,
  mode = "admin",
  onToast,
}: EmployeeHrDocumentsSectionProps) {
  const queryClient = useQueryClient();
  const isAdmin = mode === "admin";
  const { role } = useCurrentUser();
  const isHrAdmin = isAdmin && ["HR_ADMIN", "SUPER_ADMIN"].includes(role ?? "");

  const { data: generated, isLoading, isFetching } = useQuery({
    queryKey: ["employee-hr-documents", employeeId],
    queryFn: async () => {
      const res = await fetch(
        `/api/employees/${employeeId}/documents/generated?sync=true`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load HR documents");
      return json.data as GeneratedDocumentItem[];
    },
  });

  const invalidateDocs = () => {
    queryClient.invalidateQueries({ queryKey: ["employee-hr-documents", employeeId] });
  };

  const generateMutation = useMutation({
    mutationFn: async (type: "OFFER_LETTER" | "WELCOME_EMAIL") => {
      const res = await fetch(`/api/employees/${employeeId}/documents/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate");
    },
    onSuccess: async () => {
      invalidateDocs();
      onToast?.("Document generated");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: async (generatedDocumentId: string) => {
      const res = await fetch(
        `/api/employees/${employeeId}/documents/send-generated`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generatedDocumentId }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send document");
    },
    onSuccess: () => onToast?.("Document sent to employee"),
    onError: (e: Error) => onToast?.(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (generatedDocumentId: string) => {
      const res = await fetch(
        `/api/employees/${employeeId}/documents/generated/${generatedDocumentId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? json.error ?? "Failed to remove document");
    },
    onSuccess: () => {
      invalidateDocs();
      onToast?.("HR document removed");
    },
    onError: (e: Error) => onToast?.(e.message),
  });

  const byType = new Map((generated ?? []).map((doc) => [doc.type, doc]));
  const syncing = isLoading || isFetching;

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">HR Documents</h2>
        <p className="text-sm text-muted-foreground">
          Auto-generated from this employee&apos;s profile data
        </p>
      </div>

      {syncing && !generated?.length ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {HR_DOC_TYPES.map(({ type, title }) => {
            const doc = byType.get(type);

            return (
              <Card key={type}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{title}</p>
                    {isHrAdmin && doc && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            disabled={
                              generateMutation.isPending || removeMutation.isPending
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Document actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => generateMutation.mutate(type)}
                            disabled={generateMutation.isPending}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Regenerate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={removeMutation.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Remove this ${title}? You can regenerate it later from the employee profile.`
                                )
                              ) {
                                removeMutation.mutate(doc.id);
                              }
                            }}
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {syncing ? (
                    <p className="text-sm text-muted-foreground">Updating…</p>
                  ) : doc ? (
                    <p className="text-sm text-green-700">
                      Generated {formatDisplayDate(doc.generatedAt)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not yet generated</p>
                  )}

                  {doc && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Preview
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={doc.fileUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download PDF
                        </a>
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={sendMutation.isPending}
                          onClick={() => sendMutation.mutate(doc.id)}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Send
                        </Button>
                      )}
                    </div>
                  )}

                  {isAdmin && !doc && (
                    <Button
                      size="sm"
                      disabled={generateMutation.isPending}
                      onClick={() => generateMutation.mutate(type)}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Generate {title}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
