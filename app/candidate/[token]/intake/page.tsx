"use client";

import { useState, use, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  CheckCircle,
  Loader2,
  XCircle,
  Upload,
  X,
  User,
  MapPin,
  AlertCircle,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { US_STATES } from "@/lib/constants/us-states";
import { candidateIntakeSchema, T_SHIRT_SIZES, type CandidateIntakeInput } from "@/lib/candidate/intake-validation";
import { normalizePhoneOnBlur, sanitizePhoneInput } from "@/lib/schedule";

type OfferSummary = {
  candidateFirst: string;
  candidateLast: string;
  jobTitle: string;
  status: string;
};

const intakeFormSchema = candidateIntakeSchema.omit({
  idFileUrl: true,
  idFileName: true,
});

type FormValues = Omit<CandidateIntakeInput, "idFileUrl" | "idFileName">;

function sanitizeZipInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5);
}

export default function CandidateIntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [idFile, setIdFile] = useState<{ url: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: offer, isLoading, error } = useQuery<OfferSummary>({
    queryKey: ["candidate-offer-intake", token],
    queryFn: async () => {
      const res = await fetch(`/api/candidate/${token}`);
      if (!res.ok) throw new Error("Offer not found");
      const json = await res.json();
      return json.data;
    },
    retry: false,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: { emergencyContactConsent: false, addressCountry: "US" },
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/candidate/${token}/intake/upload`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Upload failed");
        return;
      }
      setIdFile({ url: json.data.fileUrl, name: json.data.fileName });
      toast.success("File uploaded");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/candidate/${token}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          idFileUrl: idFile?.url ?? undefined,
          idFileName: idFile?.name ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.message ?? "Submission failed");
        return;
      }
      setSubmitted(true);
      toast.success("Form submitted successfully!");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-lg font-semibold mb-2">Invalid Link</h1>
            <p className="text-sm text-muted-foreground">Please contact HR.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (offer.status === "INTAKE_COMPLETE" || offer.status === "CONVERTED") {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-lg font-semibold mb-2">Already Submitted</h1>
            <p className="text-sm text-muted-foreground">
              Your intake form has been received. HR will be in touch shortly.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => router.push(`/candidate/${token}`)}>
              Back to Offer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (offer.status !== "APPROVED") {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
            <h1 className="text-lg font-semibold mb-2">Accept the Offer First</h1>
            <p className="text-sm text-muted-foreground">
              Please accept your job offer before completing the intake form.
            </p>
            <Button className="mt-4" onClick={() => router.push(`/candidate/${token}`)}>
              View Offer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-md">
          <CardContent className="py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-xl font-bold mb-2 text-slate-800">You&apos;re all set!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Thank you, <strong>{offer.candidateFirst}</strong>! Your information has been received.
              HR will create your employee account and send you login details before your start date.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-muted-foreground text-sm">Bazaar Printing · New Employee Intake</p>
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome, {offer.candidateFirst}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Please complete the form below for your role as <strong>{offer.jobTitle}</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Personal Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Phone Number <span className="text-destructive">*</span></Label>
                  <Input
                    value={watch("phone") ?? ""}
                    inputMode="tel"
                    placeholder="+1 555 000 0000"
                    onChange={(e) =>
                      setValue("phone", sanitizePhoneInput(e.target.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    onBlur={(e) =>
                      setValue("phone", normalizePhoneOnBlur(e.target.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Personal Email</Label>
                  <Input {...register("personalEmail")} type="email" placeholder="you@gmail.com" />
                  {errors.personalEmail && <p className="text-xs text-destructive">{errors.personalEmail.message}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Date of Birth</Label>
                <Input {...register("birthdate")} type="date" />
                {errors.birthdate && <p className="text-xs text-destructive">{errors.birthdate.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>T-Shirt Size</Label>
                <Select
                  value={watch("tShirtSize") ?? ""}
                  onValueChange={(v) => setValue("tShirtSize", v, { shouldDirty: true, shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size…" />
                  </SelectTrigger>
                  <SelectContent>
                    {T_SHIRT_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.tShirtSize && <p className="text-xs text-destructive">{errors.tShirtSize.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Allergies / Dietary Restrictions</Label>
                <Textarea
                  {...register("allergies")}
                  placeholder="List any allergies or dietary restrictions, or leave blank if none"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Home Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Street Address</Label>
                <Input {...register("addressStreet")} placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input {...register("addressCity")} placeholder="Los Angeles" />
                </div>
                <div className="space-y-1">
                  <Label>State</Label>
                  <Select
                    value={watch("addressState") ?? ""}
                    onValueChange={(value) =>
                      setValue("addressState", value, { shouldDirty: true, shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.addressState && (
                    <p className="text-xs text-destructive">{errors.addressState.message}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>ZIP Code</Label>
                  <Input
                    value={watch("addressZip") ?? ""}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="90001"
                    onChange={(e) =>
                      setValue("addressZip", sanitizeZipInput(e.target.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                  {errors.addressZip && <p className="text-xs text-destructive">{errors.addressZip.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Country</Label>
                  <Input
                    {...register("addressCountry")}
                    placeholder="US"
                    onBlur={(e) => {
                      setValue("addressCountry", e.target.value.trim().toUpperCase(), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4 text-muted-foreground" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input {...register("emergencyContactName")} placeholder="John Smith" />
                  {errors.emergencyContactName && (
                    <p className="text-xs text-destructive">{errors.emergencyContactName.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Relationship <span className="text-destructive">*</span></Label>
                  <Input {...register("emergencyContactRelation")} placeholder="Spouse, Parent…" />
                  {errors.emergencyContactRelation && (
                    <p className="text-xs text-destructive">{errors.emergencyContactRelation.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Phone Number <span className="text-destructive">*</span></Label>
                <Input
                  value={watch("emergencyContactPhone") ?? ""}
                  inputMode="tel"
                  placeholder="+1 555 000 0000"
                  onChange={(e) =>
                    setValue("emergencyContactPhone", sanitizePhoneInput(e.target.value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  onBlur={(e) =>
                    setValue("emergencyContactPhone", normalizePhoneOnBlur(e.target.value), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                {errors.emergencyContactPhone && (
                  <p className="text-xs text-destructive">{errors.emergencyContactPhone.message}</p>
                )}
              </div>
              <div className="flex items-start gap-3 pt-1">
                <Checkbox
                  id="emergency-consent"
                  checked={watch("emergencyContactConsent")}
                  onCheckedChange={(checked) =>
                    setValue("emergencyContactConsent", checked === true)
                  }
                />
                <Label
                  htmlFor="emergency-consent"
                  className="text-sm leading-relaxed cursor-pointer font-normal"
                >
                  I authorize Bazaar Printing to contact the person listed above in case of an
                  emergency involving me.
                </Label>
              </div>
              {errors.emergencyContactConsent && (
                <p className="text-xs text-destructive">{errors.emergencyContactConsent.message}</p>
              )}
            </CardContent>
          </Card>

          {/* ID Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                Identity Document
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload a copy of your government-issued ID, passport, or business card.
                Accepted formats: PDF, JPG, PNG (max 10 MB).
              </p>

              {idFile ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-800 truncate flex-1">{idFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setIdFile(null)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="id-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-24 border-dashed flex-col gap-1 text-muted-foreground"
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                    <span className="text-sm">
                      {uploading ? "Uploading…" : "Click to upload ID"}
                    </span>
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Optional — you may skip this and provide it on your first day.
              </p>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 text-base"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</>
            ) : (
              "Submit Intake Form"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground pb-6">
            Your information is securely stored and used only to create your employee profile.
          </p>
        </form>
      </div>
    </div>
  );
}
