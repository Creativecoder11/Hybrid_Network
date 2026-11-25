// Preset providers offered in the plan form. Picking "Other" lets an admin type
// a custom provider name, so a stored plan's provider can be any string.
// Kept free of server imports so client components can use it.
export const PLAN_PROVIDERS = ["Starlink", "OneWeb", "Inmarsat", "Iridium", "Fiber", "VSAT"] as const;
export type PlanProvider = (typeof PLAN_PROVIDERS)[number];
export const PLAN_PROVIDER_MAX_LENGTH = 60;

// Value of the "Other" option in the plan form's provider select. Never stored:
// the server swaps it for the typed custom name. A sentinel rather than "Other"
// so it can't collide with a provider name (old plans may be saved as "Other").
export const PLAN_PROVIDER_OTHER = "__other__";
