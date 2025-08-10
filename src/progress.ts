export type ProgressUpdate = {
  phase: 'chunk' | 'status';
  message: string;
  current?: number;
  total?: number;
};

let reporter: ((u: ProgressUpdate) => void) | null = null;
let cancelled = false;

export function setProgressReporter(fn: (u: ProgressUpdate) => void) {
  reporter = fn;
}

export function clearProgressReporter() {
  reporter = null;
}

export function reportProgress(update: ProgressUpdate) {
  if (reporter) {
    try {
      reporter(update);
    } catch {
      // ignore UI errors
    }
  }
}

export function requestCancel() {
  cancelled = true;
}

export function resetCancel() {
  cancelled = false;
}

export function isCancelled(): boolean {
  return cancelled;
}
