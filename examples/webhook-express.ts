import express, { type Request, type Response } from 'express'; // npm i express (not a dependency of the SDK)
import { constructEvent, WebhookSignatureError } from '@stampmitra/sdk/webhooks-node';

const app = express();

// IMPORTANT: verify against the RAW body, not re-serialised JSON.
app.post(
  '/webhooks/stampmitra',
  express.raw({ type: 'application/json' }),
  (req: Request, res: Response) => {
    try {
      const event = constructEvent(
        req.body as Buffer,
        String(req.header('X-Webhook-Timestamp')),
        String(req.header('X-Webhook-Signature')),
        process.env.STAMPMITRA_WEBHOOK_SECRET!,
      );
      console.log('event', req.header('X-Webhook-Event-Id'), event);
      res.sendStatus(200);
    } catch (err) {
      if (err instanceof WebhookSignatureError) return void res.status(400).send(err.reason);
      throw err;
    }
  },
);

app.listen(3000);
