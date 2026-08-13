export type AdvanceStepResult =
  | { status: "advanced"; currentStep: number }
  | { status: "stale"; currentStep: number }
  | { status: "not-found" };
