import { StampMitra, type StampMitraOptions } from '../src/index.js';

export const TEST_KEY = 'sk_test_abcdefgh12345678';

export type Step =
  | number
  | 'connection_error'
  | 'timeout'
  | 'body_error'
  | { status: number; headers?: Record<string, string>; body?: unknown; text?: string };

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

/** A scripted fetch: each call consumes the next step (the last step repeats). */
export function scriptedFetch(steps: Step[]) {
  const calls: Call[] = [];
  const fetchFn = async (url: string, init: RequestInit = {}): Promise<Response> => {
    calls.push({
      url,
      method: String(init.method),
      headers: { ...(init.headers as Record<string, string>) },
      body: init.body as string | undefined,
    });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)] ?? 200;
    if (step === 'connection_error') throw new TypeError('fetch failed');
    if (step === 'timeout') {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    }
    if (step === 'body_error') {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => {
          throw new TypeError('terminated');
        },
      } as unknown as Response;
    }
    const s = typeof step === 'number' ? { status: step } : step;
    const body =
      s.text ??
      JSON.stringify(
        s.body ??
          (s.status >= 400
            ? { error: { code: 'E', message: `status ${s.status}`, requestId: 'req_1' } }
            : { ok: true }),
      );
    return new Response(body, { status: s.status, headers: s.headers });
  };
  return { fetch: fetchFn, calls };
}

export function makeClient(steps: Step[], extra: Partial<StampMitraOptions> = {}) {
  const sf = scriptedFetch(steps);
  const sleeps: number[] = [];
  const client = new StampMitra({
    apiKey: TEST_KEY,
    fetch: sf.fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 1,
    ...extra,
  });
  return { client, calls: sf.calls, sleeps };
}
