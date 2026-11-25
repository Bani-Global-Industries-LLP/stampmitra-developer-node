import { readFile } from 'node:fs/promises';
import { StampMitra, PaymentRequiredError, ValidationError } from '@stampmitra/sdk';

const client = new StampMitra({ apiKey: process.env.STAMPMITRA_API_KEY });

// What does the state need? `exampleBody` is a valid single-stamp body for the combination.
const req = await client.estamp.getStateRequirements('MH', {
  articleCode: 'ART1',
  denomination: 500,
  category: 'e_stamp',
});
console.log(req.exampleBody);

const body = {
  reference: 'lease-2026-0412',
  stamps: [
    {
      clientReference: 'line-1',
      state: 'MH',
      articleCode: 'ART1',
      denomination: 500,
      stampDutyPayer: 'FIRST_PARTY',
      firstParty: { name: 'Jane Doe', address: '12 MG Road, Pune' },
      secondParty: 'John Smith',
    },
  ],
};

// 1. Validate: nothing is saved or charged.
const check = await client.estamp.validateOrder(body);
console.log(check.status, check.quote);
if (!check.valid) throw new Error(`Invalid order: ${JSON.stringify(check.errors)}`);

// 2. Create. The API requires an Idempotency-Key: derive it from something stable you own and persist it.
let order;
try {
  order = await client.estamp.createOrder(body, { idempotencyKey: 'lease-2026-0412-v1' });
} catch (err) {
  if (err instanceof PaymentRequiredError) console.error('Top up the', err.wallet, 'wallet');
  else if (err instanceof ValidationError) console.error(err.fieldErrors);
  throw err;
}
console.log(order.id, order.status);

// 3. The payer's PAN card: not needed to place the order, but mandatory to complete the stamp (PDF, JPEG or PNG, up to 10 MB).
await client.estamp.uploadOrderDocument(order.id, {
  file: new Blob([await readFile('pan.pdf')], { type: 'application/pdf' }),
  fileName: 'pan.pdf',
});

// 4. List the stamps, then fetch a certificate once it has been delivered.
const { items } = await client.estamp.listOrderStamps(order.id);
for (const stamp of items) {
  const cert = await client.estamp.getStampCertificate(stamp.id);
  if (cert.available) console.log(stamp.id, cert.certificateNumber, cert.downloadUrl);
  else console.log(stamp.id, 'certificate not yet available');
}
