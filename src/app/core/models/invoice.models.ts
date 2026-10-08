/** `GET /customer/invoices?orderUuid=` — manufest_be's invoices module.
 * One TAX_INVOICE (or BILL_OF_SUPPLY, for a seller without GST) per seller
 * in the order once their first item ships, plus a CREDIT_NOTE for each
 * later return/cancellation of an invoiced item. */
export interface InvoiceSummary {
  uuid: string;
  docType: 'TAX_INVOICE' | 'BILL_OF_SUPPLY' | 'CREDIT_NOTE';
  invoiceNumber: string;
  issuedAt: string;
  orderUuid: string;
  orderNumber: string;
  orderSellerGroupUuid: string;
  sellerName: string;
  totalAmount: number;
  originalInvoiceNumber: string | null;
  reason: string | null;
}
