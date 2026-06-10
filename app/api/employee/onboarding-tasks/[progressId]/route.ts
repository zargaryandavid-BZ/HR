import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getEmployeeSession } from "@/lib/employee-session";
import { completeOnboardingTask, saveOnboardingTaskDraft, getOnboardingTasksForEmployee } from "@/lib/onboarding/tasks";

type RouteParams = { params: Promise<{ progressId: string }> };

/** Save or complete an onboarding task (form/survey) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getEmployeeSession();
    if (!session) return apiError("Unauthorized", "Not authenticated", 401);

    const { progressId } = await params;
    const body = await request.json();
    const responseData = (body.responseData ?? {}) as Record<string, unknown>;
    const status = body.status as string | undefined;
    const complete = status !== "IN_PROGRESS";

    const data = complete
      ? await completeOnboardingTask(progressId, session.employeeId, responseData, true)
      : await (async () => {
          await saveOnboardingTaskDraft(progressId, session.employeeId, responseData);
          return getOnboardingTasksForEmployee(session.employeeId, { excludeDocumentSign: true });
        })();

    return Response.json(
      apiSuccess(data, complete ? "Task completed" : "Progress saved")
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update task";
    const status = message === "Task not found" ? 404 : 400;
    return apiError("Failed", message, status);
  }
}
