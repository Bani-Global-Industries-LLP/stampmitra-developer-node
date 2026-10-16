import { constructEventFromHeaders, WebhookSignatureError } from '@stampmitra/sdk/webhooks';

interface Env {
  STAMPMITRA_WEBHOOK_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
    try {
      const event = await constructEventFromHeaders(
        await request.text(),
        request.headers,
        env.STAMPMITRA_WEBHOOK_SECRET,
      );
      console.log(event);
      return new Response('ok');
    } catch (err) {
      if (err instanceof WebhookSignatureError) return new Response(err.reason, { status: 400 });
      throw err;
    }
  },
};
