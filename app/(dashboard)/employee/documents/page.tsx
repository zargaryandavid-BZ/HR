"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";
import { Download } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { ToastBanner } from "@/components/shared/toast-banner";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { SignedFileUploadZone } from "@/components/shared/signed-file-upload-zone";
import type { EmployeeDocumentItem } from "@/lib/documents/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Employee self-service page for assigned documents */
export default function EmployeeDocumentsPage() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["employee-documents"],
    queryFn: async () => {
      const res = await fetch("/api/employee/documents");
      const json = await res.json();
      return json.data as EmployeeDocumentItem[];
    },
  });

  async function handleUpload(documentId: string, file: File) {
    setUploadingId(documentId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/employee/documents/${documentId}/upload`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      void queryClient.invalidateQueries({ queryKey: ["employee-documents"] });
      void queryClient.invalidateQueries({ queryKey: ["employee-documents-unack-count"] });
      setToast("Signed copy uploaded and document acknowledged");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div>
      <ToastBanner message={toast} variant="success" />
      <PageHeader
        title="Documents"
        description="Review and acknowledge documents assigned to you."
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !documents?.length ? (
        <EmptyState
          title="No documents assigned"
          description="When HR assigns documents to you, they will appear here."
        />
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              uploading={uploadingId === doc.id}
              onUpload={(file) => void handleUpload(doc.id, file)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  doc,
  uploading,
  onUpload,
}: {
  doc: EmployeeDocumentItem;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const existingFile =
    doc.signedFileName && doc.signedFileUrl
      ? { fileName: doc.signedFileName, fileUrl: doc.signedFileUrl }
      : null;

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <DocumentTypeBadge type={doc.documentType} />
              <Badge variant="outline">v{doc.version}</Badge>
            </div>
            <h3 className="font-semibold text-lg">{doc.title}</h3>
            <p className="text-sm text-muted-foreground">{doc.description}</p>
          </div>
          <Badge variant={doc.acknowledged ? "success" : "destructive"}>
            {doc.acknowledged && doc.acknowledgedAt
              ? `Acknowledged on ${formatDisplayDate(doc.acknowledgedAt)}`
              : "Not yet acknowledged"}
          </Badge>
        </div>

        <Button variant="default" asChild>
          <a href={doc.fileUrl} download target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4 mr-2" />
            Download Document
          </a>
        </Button>

        {!doc.acknowledged && (
          <SignedFileUploadZone
            existingFile={existingFile}
            disabled={uploading}
            uploading={uploading}
            onUpload={onUpload}
          />
        )}

        {doc.acknowledged && doc.signedFileUrl && (
          <p className="text-sm text-muted-foreground">
            Signed copy uploaded on{" "}
            {doc.signedAt ? formatDisplayDate(doc.signedAt) : "—"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
