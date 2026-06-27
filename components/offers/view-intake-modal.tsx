"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, ExternalLink, User, MapPin, Heart, Shirt, AlertCircle } from "lucide-react";

type IntakeResponse = {
  id: string;
  phone: string | null;
  personalEmail: string | null;
  birthdate: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  emergencyContactConsent: boolean;
  tShirtSize: string | null;
  allergies: string | null;
  idFileUrl: string | null;
  idFileName: string | null;
  submittedAt: string;
};

type OfferWithIntake = {
  candidateFirst: string;
  candidateLast: string;
  jobTitle: string;
  intake: IntakeResponse | null;
};

type Props = {
  offerId: string | null;
  open: boolean;
  onClose: () => void;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="space-y-2 pl-1">{children}</div>
    </div>
  );
}

export function ViewIntakeModal({ offerId, open, onClose }: Props) {
  const { data, isLoading } = useQuery<OfferWithIntake>({
    queryKey: ["offer-intake", offerId],
    queryFn: async () => {
      const res = await fetch(`/api/offers/${offerId}`);
      const json = await res.json();
      return json.data;
    },
    enabled: open && !!offerId,
  });

  const intake = data?.intake;

  const addressParts = [
    intake?.addressStreet,
    intake?.addressCity,
    intake?.addressState,
    intake?.addressZip,
    intake?.addressCountry !== "US" ? intake?.addressCountry : null,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Intake Form
            {intake && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs font-normal">
                Submitted {format(new Date(intake.submittedAt), "MMM d, yyyy")}
              </Badge>
            )}
          </DialogTitle>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.candidateFirst} {data.candidateLast} · {data.jobTitle}
            </p>
          )}
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && !intake && (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
            <AlertCircle className="h-8 w-8 text-amber-400" />
            No intake form submitted yet.
          </div>
        )}

        {intake && (
          <div className="space-y-5 pt-1">
            {/* Personal Info */}
            <Section icon={User} title="Personal Information">
              <Row label="Phone" value={intake.phone} />
              <Row label="Personal Email" value={intake.personalEmail} />
              <Row
                label="Date of Birth"
                value={intake.birthdate ? format(new Date(intake.birthdate), "MMMM d, yyyy") : null}
              />
            </Section>

            {/* Address */}
            {addressParts.length > 0 && (
              <Section icon={MapPin} title="Home Address">
                <Row label="Address" value={addressParts.join(", ")} />
              </Section>
            )}

            {/* Emergency Contact */}
            {intake.emergencyContactName && (
              <Section icon={Heart} title="Emergency Contact">
                <Row label="Name" value={intake.emergencyContactName} />
                <Row label="Relationship" value={intake.emergencyContactRelation} />
                <Row label="Phone" value={intake.emergencyContactPhone} />
                <Row
                  label="Authorization"
                  value={
                    intake.emergencyContactConsent ? (
                      <span className="text-green-700">Authorized</span>
                    ) : (
                      <span className="text-red-600">Not authorized</span>
                    )
                  }
                />
              </Section>
            )}

            {/* Extras */}
            {(intake.tShirtSize || intake.allergies) && (
              <Section icon={Shirt} title="Additional Info">
                <Row label="T-Shirt Size" value={intake.tShirtSize} />
                <Row label="Allergies / Diet" value={intake.allergies} />
              </Section>
            )}

            {/* Document */}
            {intake.idFileUrl && (
              <Section icon={FileText} title="Identity Document">
                <a
                  href={intake.idFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <FileText className="h-4 w-4" />
                  {intake.idFileName ?? "View document"}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
