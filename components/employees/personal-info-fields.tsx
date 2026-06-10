"use client";

import { differenceInYears } from "date-fns";
import type { Control, FieldErrors, UseFormRegister, UseFormWatch } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { EmployeeFormValues } from "@/lib/validations";
import { US_STATES } from "@/lib/constants/us-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeIdentityDocumentsSection } from "@/components/employees/employee-identity-documents-section";
import { EmployeePreferencesReadonly } from "@/components/employees/employee-preferences-readonly";
import type { TShirtSize } from "@prisma/client";

type PersonalInfoFieldsProps = {
  register: UseFormRegister<EmployeeFormValues>;
  control: Control<EmployeeFormValues>;
  watch: UseFormWatch<EmployeeFormValues>;
  errors: FieldErrors<EmployeeFormValues>;
  employeeId?: string;
  onToast?: (message: string) => void;
  tShirtSize?: TShirtSize | null;
  allergies?: string | null;
};

/** Radix Select requires undefined (not "") when no item is selected */
function toSelectValue(value: string | null | undefined): string | undefined {
  return value ? value : undefined;
}

/** Address, identity documents, and birthdate fields for employee forms */
export function PersonalInfoFields({
  register,
  control,
  watch,
  errors,
  employeeId,
  onToast,
  tShirtSize,
  allergies,
}: PersonalInfoFieldsProps) {
  const birthdate = watch("birthdate");
  const age =
    birthdate && !Number.isNaN(new Date(birthdate).getTime())
      ? differenceInYears(new Date(), new Date(birthdate))
      : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Home Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addressStreet">Street Address</Label>
            <Input id="addressStreet" {...register("addressStreet")} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addressCity">City</Label>
              <Input id="addressCity" {...register("addressCity")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressCountry">Country</Label>
              <Input id="addressCountry" {...register("addressCountry")} placeholder="US" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>State</Label>
              <Controller
                name="addressState"
                control={control}
                render={({ field }) => (
                  <Select
                    value={toSelectValue(field.value)}
                    onValueChange={field.onChange}
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
                )}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="addressZip">ZIP Code</Label>
              <Input
                id="addressZip"
                inputMode="numeric"
                maxLength={5}
                {...register("addressZip", {
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 5);
                  },
                })}
              />
              {errors.addressZip && (
                <p className="text-sm text-destructive">{errors.addressZip.message}</p>
              )}
            </div>
          </div>

          {employeeId && (
            <div className="border-t pt-6 mt-2">
              <EmployeeIdentityDocumentsSection
                employeeId={employeeId}
                onToast={onToast}
                embedded
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Birthdate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="birthdate">Date of Birth</Label>
              <Input id="birthdate" type="date" {...register("birthdate")} />
              {errors.birthdate && (
                <p className="text-sm text-destructive">{errors.birthdate.message}</p>
              )}
              {age !== null && age >= 16 && (
                <p className="text-sm text-muted-foreground">Age: {age}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {employeeId && (
          <EmployeePreferencesReadonly
            embedded
            tShirtSize={tShirtSize}
            allergies={allergies}
          />
        )}
      </div>
    </div>
  );
}
