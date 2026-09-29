/**
 * Rejects if `promise` hasn't settled within `ms`. Firestore *writes* are the reason this exists:
 * when the browser can't reach Firestore, addDoc()/batch.commit() don't fail - they queue the write
 * offline and the returned promise simply never resolves, which shows up as a button spinning forever.
 * A timeout turns that silent hang into a real, explainable error.
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} took longer than ${Math.round(ms / 1000)} seconds and was stopped.`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = "The request"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
