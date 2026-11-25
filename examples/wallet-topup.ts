import { StampMitra } from '@stampmitra/sdk';

const client = new StampMitra({ apiKey: process.env.STAMPMITRA_API_KEY });

// Both wallets in one read: the Stamp duty wallet and the Service wallet (`serviceFee`, name kept for
// compatibility). Balances are decimal strings: parse them.
const wallets = await client.estamp.getWallet();
console.log('Stamp duty:', wallets.balance, 'Service wallet:', wallets.serviceFee.balance);

// Top up the Stamp duty wallet. The fee and GST are added on top of baseAmount and the wallet is credited
// baseAmount: show your payer the figures from the response, do not compute them.
const topup = await client.stampDutyWallet.topup({ baseAmount: 1000 });
console.log(topup.processingFeeAmount, topup.gstAmount, topup.totalCharged, topup.creditAmount);
console.log('Pay Razorpay order', topup.razorpayOrderId);

// Later: the ledger and the GST tax invoice for the fee.
for await (const row of client.stampDutyWallet.listAllTransactions({ limit: 50 })) {
  console.log(row.createdAt, row.type, row.amount, row.balanceAfter);
}
const invoices = await client.stampDutyWallet.listInvoices();
console.log(invoices.items.map((i) => i.invoiceNumber));
