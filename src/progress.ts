export type ProgressUpdate = {
  phase: 'chunk' | 'status';
  message: string;
  current?: number;
  total?: number;
};

let reporter: ((u: ProgressUpdate) => void) | null = null;

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
