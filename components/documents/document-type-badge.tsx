import type { DocumentType } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPE_BADGE_CLASSES,
  DOCUMENT_TYPE_SHORT_LABELS,
} from "@/lib/documents/constants";

type DocumentTypeBadgeProps = {
  type: DocumentType;
  className?: string;
};

/** Color-coded badge for document type */
export function DocumentTypeBadge({ type, className }: DocumentTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        DOCUMENT_TYPE_BADGE_CLASSES[type],
        className
      )}
    >
      {DOCUMENT_TYPE_SHORT_LABELS[type]}
    </span>
  );
}
