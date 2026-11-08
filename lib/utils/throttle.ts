// Runs a background-maintenance job at most once per `intervalMs` per server
// process. Concurrent callers share the run in progress, and callers inside
// the interval after a run return immediately. Used for "catch-up" jobs that
// page loads trigger (overdue sync, recurring invoices) so they stop adding a
// database write to every single request.

type ThrottleState = { lastRunAt: number; running: Promise<void> | null };

declare global {
  var _throttleState: Map<string, ThrottleState> | undefined;
}

const states: Map<string, ThrottleState> = globalThis._throttleState ?? new Map();
globalThis._throttleState = states;

export function runThrottled(key: string, intervalMs: number, job: () => Promise<void>): Promise<void> {
  const state = states.get(key) ?? { lastRunAt: 0, running: null };
  states.set(key, state);

  if (state.running) return state.running;
  if (Date.now() - state.lastRunAt < intervalMs) return Promise.resolve();

  state.running = job()
    .then(() => {
      state.lastRunAt = Date.now();
    })
    .finally(() => {
      state.running = null;
    });
  return state.running;
}
