/**
 * MSW handlers for collaboration/sharing endpoints.
 */

import { http, HttpResponse } from "msw";
import { testCollaborationContextEmpty } from "../../fixtures/factories";

export const collaborationHandlers = [
  // Get collaboration context
  http.get("**/api/v1/collaboration/context", () => {
    return HttpResponse.json(testCollaborationContextEmpty);
  }),
];
