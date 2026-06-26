"use client";

import { SendDocumentsForSignatureDialog } from "@/components/employees/send-documents-for-signature-dialog";

type SendOffboardingSignatureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSuccess: (message: string) => void;
};

/** Offboarding send-for-signature dialog with document selection */
export function SendOffboardingSignatureDialog(props: SendOffboardingSignatureDialogProps) {
  const { employeeId, ...rest } = props;

  return (
    <SendDocumentsForSignatureDialog
      {...rest}
      employeeId={employeeId}
      sendApiPath={`/api/employees/${employeeId}/offboarding-docs/send`}
      queryKey={["sendable-offboarding-docs", employeeId]}
      invalidateQueryKeys={[
        ["employee-offboarding-docs", employeeId],
        ["sendable-offboarding-docs", employeeId],
        ["unsent-offboarding-docs", employeeId],
      ]}
      dialogTitle="Send offboarding documents for signature"
    />
  );
}
