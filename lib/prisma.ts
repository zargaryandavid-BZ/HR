import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Create a fresh Prisma client instance */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

type ModelDelegate = { findMany?: unknown };

/** Model delegates that must exist — detects stale cached clients after schema changes */
const REQUIRED_DELEGATES = [
  "offboardingInstance",
  "offboardingTemplate",
  "accrualPolicy",
  "leaveAccrualLog",
] as const;

/** Employee scalar fields added in recent schema migrations */
const REQUIRED_EMPLOYEE_FIELDS = ["isNonExempt"] as const;

function hasModelDelegate(client: PrismaClient, key: string): boolean {
  const delegate = (client as unknown as Record<string, ModelDelegate | undefined>)[key];
  return typeof delegate?.findMany === "function";
}

function employeeHasRequiredFields(): boolean {
  const employee = Prisma.dmmf.datamodel.models.find((m) => m.name === "Employee");
  if (!employee) return false;
  return REQUIRED_EMPLOYEE_FIELDS.every((field) =>
    employee.fields.some((f) => f.name === field)
  );
}

function isStaleClient(client: PrismaClient): boolean {
  if (REQUIRED_DELEGATES.some((key) => !hasModelDelegate(client, key))) {
    return true;
  }
  return !employeeHasRequiredFields();
}

let prisma = globalForPrisma.prisma ?? createPrismaClient();

if (isStaleClient(prisma)) {
  prisma = createPrismaClient();
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Singleton Prisma client for server-side database access */
export { prisma };

/** Whether offboarding models are available on the current client (after generate + restart) */
export function hasOffboardingModels(): boolean {
  return hasModelDelegate(prisma, "offboardingInstance");
}
