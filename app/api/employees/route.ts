import { NextRequest } from "next/server";
import { getSession, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError, getPaginationParams } from "@/lib/api-response";
import { employeeFormSchema } from "@/lib/validations";
import { createEmployee, buildEmployeeWhereClause } from "@/lib/employees";
import { employeeListSelect, sanitizeEmployeeResponse } from "@/lib/employees/personal-info";
import { getMissingSignedDocumentCounts } from "@/lib/individual-settings/documents";
import { getEmployeeIdsWithExpiringDocuments } from "@/lib/identity-documents/service";

/** List employees with search, filter, and pagination */
export async function GET(request: NextRequest) {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7374/ingest/7a917bd3-06c4-4038-afd9-2a1b75bd40c7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f611a2'},body:JSON.stringify({sessionId:'f611a2',location:'app/api/employees/route.ts:13',message:'GET /api/employees called',data:{url:request.url},timestamp:Date.now(),hypothesisId:'H-A'})}).catch(()=>{});
    // #endregion
    const session = await getSession();
    // #region agent log
    fetch('http://127.0.0.1:7374/ingest/7a917bd3-06c4-4038-afd9-2a1b75bd40c7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f611a2'},body:JSON.stringify({sessionId:'f611a2',location:'app/api/employees/route.ts:17',message:'session result',data:{sessionExists:!!session,role:session?.role??null},timestamp:Date.now(),hypothesisId:'H-A'})}).catch(()=>{});
    // #endregion
    if (!session) {
      return apiError("Unauthorized", "Not authenticated", 401);
    }
    if (!["HR_ADMIN", "SUPER_ADMIN", "MANAGER"].includes(session.role)) {
      return apiError("Forbidden", "Not authorized", 403);
    }

    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = getPaginationParams(searchParams);
    const search = searchParams.get("search") ?? undefined;
    const departmentId = searchParams.get("departmentId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;

    const where = buildEmployeeWhereClause({ search, departmentId, status });

    const [employees, total, allFilteredEmployees] = await Promise.all([
      prisma.employee.findMany({
        where,
        select: employeeListSelect,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip,
        take: limit,
      }),
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        select: { id: true, positionId: true, departmentId: true },
      }),
    ]);

    // #region agent log
    fetch('http://127.0.0.1:7374/ingest/7a917bd3-06c4-4038-afd9-2a1b75bd40c7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f611a2'},body:JSON.stringify({sessionId:'f611a2',location:'app/api/employees/route.ts:47',message:'prisma query succeeded',data:{employeeCount:employees.length,total},timestamp:Date.now(),hypothesisId:'H-B'})}).catch(()=>{});
    // #endregion
    const missingSignedCounts = await getMissingSignedDocumentCounts(allFilteredEmployees);
    const expiringDocEmployeeIds = await getEmployeeIdsWithExpiringDocuments(
      allFilteredEmployees.map((e) => e.id),
      30
    );

    const employeesWithDocCounts = employees.map(
      ({ positionId: _positionId, departmentId: _departmentId, ...employee }) => ({
        ...employee,
        missingSignedDocuments: missingSignedCounts.get(employee.id) ?? 0,
        identityDocumentExpiring: expiringDocEmployeeIds.has(employee.id),
      })
    );

    const totalMissingSignedDocuments = [...missingSignedCounts.values()].reduce(
      (sum, count) => sum + count,
      0
    );
    const employeesWithMissingSignedDocuments = [...missingSignedCounts.values()].filter(
      (count) => count > 0
    ).length;

    return Response.json(
      apiSuccess({
        employees: employeesWithDocCounts,
        summary: { totalMissingSignedDocuments, employeesWithMissingSignedDocuments },
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      })
    );
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7374/ingest/7a917bd3-06c4-4038-afd9-2a1b75bd40c7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f611a2'},body:JSON.stringify({sessionId:'f611a2',location:'app/api/employees/route.ts:catch',message:'GET /api/employees threw',data:{error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack?.slice(0,500):null},timestamp:Date.now(),hypothesisId:'H-B H-C H-D'})}).catch(()=>{});
    // #endregion
    console.error("List employees error:", error);
    return apiError("Server error", "Failed to fetch employees", 500);
  }
}

/** Create a new employee with user account and welcome notifications */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["HR_ADMIN", "SUPER_ADMIN"]);

    const body = await request.json();
    const parsed = employeeFormSchema.safeParse(body);

    if (!parsed.success) {
      return apiError("Validation failed", parsed.error.errors[0]?.message ?? "Invalid data");
    }

    const existing = await prisma.employee.findFirst({
      where: { workEmail: parsed.data.workEmail },
    });

    if (existing) {
      return apiError("Duplicate email", "An employee with this work email already exists");
    }

    const employee = await createEmployee(parsed.data, session.id);

    return Response.json(
      apiSuccess(sanitizeEmployeeResponse(employee, session.role), "Employee created successfully"),
      { status: 201 }
    );
  } catch (error) {
    console.error("Create employee error:", error instanceof Error ? error.message : "Unknown error");
    return apiError("Server error", "Failed to create employee", 500);
  }
}
