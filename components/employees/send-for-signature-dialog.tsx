"use client";

import { SendDocumentsForSignatureDialog } from "@/components/employees/send-documents-for-signature-dialog";

type SendForSignatureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess: (message: string) => void;
};

/** Onboarding send-for-signature dialog with document selection */
export function SendForSignatureDialog(props: SendForSignatureDialogProps) {
  const { employeeId, ...rest } = props;

  return (
    <SendDocumentsForSignatureDialog
      {...rest}
      employeeId={employeeId}
      sendApiPath={`/api/employees/${employeeId}/onboarding-docs/send`}
      queryKey={["sendable-onboarding-docs", employeeId]}
      invalidateQueryKeys={[
        ["employee-settings-documents", employeeId],
        ["sendable-onboarding-docs", employeeId],
        ["unsent-onboarding-docs", employeeId],
      ]}
      dialogTitle="Send documents for signature"
    />
  );
}
