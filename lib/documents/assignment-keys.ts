/** Compound unique key for onboarding document assignments */
export function onboardingAssignmentKey(sopId: string, employeeId: string) {
  return { sopId, employeeId, isOffboarding: false as const };
}

/** Compound unique key for offboarding document assignments */
export function offboardingAssignmentKey(sopId: string, employeeId: string) {
  return { sopId, employeeId, isOffboarding: true as const };
}
