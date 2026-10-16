// app/api/webhooks/stampmitra/route.ts
import { constructEventFromHeaders, WebhookSignatureError } from '@stampmitra/sdk/webhooks';

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text(); // raw body
  try {
    const event = await constructEventFromHeaders(
      raw,
      request.headers,
      process.env.STAMPMITRA_WEBHOOK_SECRET!,
    );
    console.log('received', request.headers.get('x-webhook-event-id'), event);
    return new Response('ok');
  } catch (err) {
    if (err instanceof WebhookSignatureError) return new Response(err.reason, { status: 400 });
    throw err;
  }
}
