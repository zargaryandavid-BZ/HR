"use client";

import { format } from "date-fns";
import { formatDisplayDate } from "@/lib/dates";
import { Eye, Pencil, Users } from "lucide-react";
import type { DocumentListItem } from "@/lib/documents/constants";
import { DocumentTypeBadge } from "@/components/documents/document-type-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type DocumentCardProps = {
  doc: DocumentListItem;
  showAssign?: boolean;
  onEdit: () => void;
  onAssign?: () => void;
};

/** Repository document card for admin grid */
export function DocumentCard({
  doc,
  showAssign = false,
  onEdit,
  onAssign,
}: DocumentCardProps) {
  const visibleTags = doc.assignmentTags.slice(0, 2);
  const extraTagCount = Math.max(0, doc.assignmentTags.length - 2);

  return (
    <Card className="h-full">
      <CardContent className="pt-5 space-y-3 flex flex-col h-full">
        <DocumentTypeBadge type={doc.documentType} />
        <div className="flex-1">
          <h3 className="font-semibold">{doc.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {doc.description || "No description"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">v{doc.version}</Badge>
          <span className="text-xs text-muted-foreground">
            Updated {formatDisplayDate(doc.updatedAt)}
          </span>
        </div>
        {showAssign && doc.assignmentTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <Badge key={`${tag.kind}-${tag.id}`} variant="secondary" className="text-xs">
                {tag.label}
              </Badge>
            ))}
            {extraTagCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{extraTagCount} more
              </Badge>
            )}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" asChild>
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-1" />
              View
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          {showAssign && onAssign && (
            <Button variant="outline" size="sm" onClick={onAssign}>
              <Users className="h-4 w-4 mr-1" />
              Assign
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
