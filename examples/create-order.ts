import { StampMitra } from '@stampmitra/sdk';

const client = new StampMitra();

// An Idempotency-Key is generated automatically and reused across retries.
// Pass { idempotencyKey } to tie it to your own request id instead.
const order = await client.orders.create(
  {
    externalOrderId: 'ord_ext_123',
    externalCustomerId: 'cust_ext_456',
    serviceCode: 'estamp.instrument.rent_agreement',
    details: { state: 'MH', stampValue: 500 },
  },
  { idempotencyKey: 'my-request-id-0001' },
);
console.log(order);
console.log(await client.orders.getStatus(String(order.id)));
