/**
 * Customer support contact details and the return rule, in one place for
 * the footer, the Help center page (`/help-center`) and the order return
 * forms. The numbers are the ones the footer already showed — update them
 * here when the support team's real lines are confirmed.
 */
export interface SupportPhone {
  label: string;
  /** As shown to the customer. */
  display: string;
  /** For the `tel:` link — digits with the country/STD code. */
  dial: string;
}

export const CUSTOMER_SUPPORT = {
  email: 'manufest@gmail.com',
  phones: [
    { label: 'Mobile', display: '98765 43210', dial: '+919876543210' },
    { label: 'Landline', display: '044 - 234567', dial: '+9144234567' },
  ] as SupportPhone[],
  hours: 'Monday to Saturday, 10 AM – 6 PM',
};

/** Shown with every return request and on the Help center page. */
export const RETURN_GUIDELINE =
  'Returns are accepted only when the delivery package is in its original Manufest cover. You can initiate a return only for items delivered in a Manufest cover.';
