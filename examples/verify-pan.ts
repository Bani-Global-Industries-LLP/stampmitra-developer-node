import { StampMitra, ValidationError } from '@stampmitra/sdk';

const client = new StampMitra({ apiKey: process.env.STAMPMITRA_API_KEY });

try {
  const result = await client.verify.pan({ pan: 'ABCDE1234F', name: 'Rahul Kumar' });
  console.log(result.referenceId, result.valid, result.nameMatchResult);
} catch (err) {
  if (err instanceof ValidationError) console.error('Bad input:', err.field, err.message);
  else throw err;
}
