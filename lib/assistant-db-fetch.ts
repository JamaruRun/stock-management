// Never log credentials, query filters, customer data, or response bodies.
export async function assistantDbFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const table = url.pathname.split('/').pop() || 'unknown';
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const readOnly = method === 'GET' || method === 'HEAD';
  for (let attempt = 0; ; attempt++) {
    const started = Date.now();
    const controller = new AbortController();
    const parentSignal = init?.signal || (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort();
    if (parentSignal?.aborted) abort();
    parentSignal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 12000);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if (!response.ok) {
        console.error('assistant_db_http', { table, method, status: response.status, attempt, ms: Date.now() - started });
      }
      // Retry reads only: replaying a write could duplicate stock or ledger records.
      if (readOnly && attempt === 0 && [502, 503, 504, 520, 521, 522, 524].includes(response.status)) {
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }
      return response;
    } catch (error) {
      console.error('assistant_db_network', { table, method, attempt, ms: Date.now() - started, timeout: controller.signal.aborted });
      throw error;
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', abort);
    }
  }
}
