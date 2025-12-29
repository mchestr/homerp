/**
 * MSW handlers for billing/credits endpoints.
 */

import { http, HttpResponse } from "msw";
import {
  testCreditBalance,
  testCreditPacks,
  testCreditTransactions,
  testOperationCosts,
} from "../../fixtures/factories";

export const billingHandlers = [
  // Get credit balance
  http.get("**/api/v1/billing/balance", () => {
    return HttpResponse.json(testCreditBalance);
  }),

  // Get operation costs
  http.get("**/api/v1/billing/costs", () => {
    return HttpResponse.json(testOperationCosts);
  }),

  // Get credit packs
  http.get("**/api/v1/billing/packs", () => {
    return HttpResponse.json(testCreditPacks);
  }),

  // Get transactions
  http.get("**/api/v1/billing/transactions", () => {
    return HttpResponse.json({
      items: testCreditTransactions,
      total: testCreditTransactions.length,
      page: 1,
      limit: 20,
      total_pages: 1,
    });
  }),

  // Create checkout session
  http.post("**/api/v1/billing/checkout", () => {
    return HttpResponse.json({
      checkout_url: "https://checkout.stripe.com/mock-session",
    });
  }),

  // Get billing portal URL
  http.post("**/api/v1/billing/portal", () => {
    return HttpResponse.json({
      portal_url: "https://billing.stripe.com/mock-portal",
    });
  }),
];
