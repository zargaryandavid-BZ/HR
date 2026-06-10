"use client";

import { use, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Upload } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ token: string }> };

type PublicDocument = {
  id: string;
  title: string;
  documentType: string;
  version: number;
  fileUrl: string;
  description: string;
  signedFileUrl: string | null;
  signedAt: string | null;
};

type PublicDocsData = {
  employee: { firstName: string };
  documents: PublicDocument[];
  progress: { completed: number; total: number };
};

/** Public no-login page for new hires to download and upload signed documents */
export default function PublicDocsPage({ params }: PageProps) {
  const { token } = use(params);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-docs", token],
    queryFn: async () => {
      const res = await fetch(`/api/docs/${token}`);
      const json = await res.json();
      if (res.status === 410) throw new Error("expired");
      if (!res.ok) throw new Error(json.error ?? "invalid");
      return json.data as PublicDocsData;
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="h-dvh overflow-y-auto bg-background p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    const message =
      error.message === "expired"
        ? "This link has expired. Please contact HR for a new one."
        : "This link is invalid.";
    return (
      <div className="flex h-dvh items-center justify-center overflow-y-auto p-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">Unable to open documents</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const progressPct =
    data.progress.total > 0
      ? Math.round((data.progress.completed / data.progress.total) * 100)
      : 0;

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <p className="text-lg font-bold tracking-tight">Pixel Press Print</p>
          <h1 className="text-2xl font-semibold">Hello, {data.employee.firstName}</h1>
          <p className="text-muted-foreground text-sm">
            Please review and return your documents below. Download each one, sign it,
            and upload your signed copy.
          </p>
        </header>

        {data.progress.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                {data.progress.completed} of {data.progress.total} documents completed
              </span>
              <span>{progressPct}%</span>
            </div>
            <Progress value={progressPct} />
          </div>
        )}

        <div className="space-y-4">
          {data.documents.map((doc) => (
            <DocumentUploadCard
              key={doc.id}
              token={token}
              doc={doc}
              onUploaded={() =>
                queryClient.invalidateQueries({ queryKey: ["public-docs", token] })
              }
            />
          ))}
        </div>

        <footer className="text-center text-sm text-muted-foreground pt-4 border-t">
          Questions? Contact us at{" "}
          <a
            href="mailto:zargaryandavid@bazaarprinting.com"
            className="text-primary hover:underline"
          >
            zargaryandavid@bazaarprinting.com
          </a>
        </footer>
      </div>
    </div>
  );
}

function DocumentUploadCard({
  token,
  doc,
  onUploaded,
}: {
  token: string;
  doc: PublicDocument;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("documentId", doc.id);
      formData.append("file", file);
      const res = await fetch(`/api/docs/${token}/upload`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      return json.data as { fileName: string };
    },
    onSuccess: (result) => {
      setUploadedName(result.fileName);
      onUploaded();
    },
  });

  const isUploaded = Boolean(doc.signedFileUrl || uploadedName);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="font-semibold">{doc.title}</p>
          <DocumentTypeBadge type={doc.documentType as DocumentType} />
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={doc.fileUrl} download target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4 mr-1" />
            Download
          </a>
        </Button>
      </div>

      {doc.description && (
        <p className="text-sm text-muted-foreground">{doc.description}</p>
      )}

      <div
        className={cn(
          "rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
          isUploaded
            ? "border-green-300 bg-green-50"
            : "border-muted-foreground/30 hover:border-primary/50"
        )}
        onClick={() => !isUploaded && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !isUploaded && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
          }}
        />
        {uploadMutation.isPending ? (
          <p className="text-sm text-muted-foreground">Uploading…</p>
        ) : isUploaded ? (
          <div className="flex items-center justify-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">
              Signed copy uploaded ✓
              {uploadedName ? ` — ${uploadedName}` : ""}
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Upload your signed copy</p>
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG — max 10 MB</p>
          </div>
        )}
        {uploadMutation.isError && (
          <p className="text-xs text-destructive mt-2">
            {(uploadMutation.error as Error).message}
          </p>
        )}
      </div>

      <p
        className={cn(
          "text-xs",
          isUploaded ? "text-green-700" : "text-muted-foreground"
        )}
      >
        {isUploaded ? "Signed copy uploaded ✓" : "Not yet uploaded"}
      </p>
    </div>
  );
}
