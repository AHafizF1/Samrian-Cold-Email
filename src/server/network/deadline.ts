export function deadlineSignal(signal?: AbortSignal, timeoutMs = 30_000) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
