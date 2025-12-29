/**
 * MSW handlers for AI assistant endpoints.
 */

import { http, HttpResponse } from "msw";
import {
  testAISessions,
  testAISessionMessages,
  type AISession,
  type AIMessage,
} from "../../fixtures/factories";

// Handlers are stateless - they return fixture data by default.
// Tests can override with network.use() for dynamic behavior or custom responses.

// Note: Declutter handlers are NOT included in defaults to avoid
// conflicts with test-specific overrides. Tests that need declutter
// endpoints should use network.use() in beforeEach.

export const aiHandlers = [
  // List sessions
  http.get("**/api/v1/ai/sessions", () => {
    return HttpResponse.json({
      sessions: testAISessions,
      total: testAISessions.length,
      page: 1,
      limit: 50,
      total_pages: 1,
    });
  }),

  // Create session
  http.post("**/api/v1/ai/sessions", async ({ request }) => {
    const body = (await request.json()) as { title?: string } | null;
    const newSession: AISession = {
      // Use Date.now() + random suffix to avoid ID collisions in rapid requests
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: body?.title || "New Chat",
      message_count: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(newSession, { status: 201 });
  }),

  // Get single session with messages
  http.get("**/api/v1/ai/sessions/:sessionId", ({ params }) => {
    const { sessionId } = params;
    const session = testAISessions.find((s) => s.id === sessionId);

    if (session) {
      const messages = testAISessionMessages.filter(
        (m) => m.session_id === sessionId
      );
      return HttpResponse.json({
        ...session,
        messages,
      });
    }

    // For dynamically created sessions (e.g., from chat endpoint), return a valid session
    // This handles the case when a new session is created and the frontend tries to fetch it
    if (typeof sessionId === "string" && sessionId.startsWith("session-")) {
      return HttpResponse.json({
        id: sessionId,
        title: "New Chat",
        message_count: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: [], // Empty messages - the frontend already has them in state
      });
    }

    return HttpResponse.json({ detail: "Session not found" }, { status: 404 });
  }),

  // Update session (title)
  http.patch(
    "**/api/v1/ai/sessions/:sessionId",
    async ({ params, request }) => {
      const { sessionId } = params;
      const body = (await request.json()) as Record<string, unknown>;
      const session = testAISessions.find((s) => s.id === sessionId);
      return HttpResponse.json({
        ...session,
        ...body,
        updated_at: new Date().toISOString(),
      });
    }
  ),

  // Delete session
  http.delete("**/api/v1/ai/sessions/:sessionId", () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Chat endpoint
  http.post("**/api/v1/ai/chat", async ({ request }) => {
    const body = (await request.json()) as {
      session_id?: string;
      prompt: string;
    };
    const sessionId =
      body.session_id ||
      `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const userMessage: AIMessage = {
      id: `msg-user-${Date.now()}`,
      session_id: sessionId,
      role: "user",
      content: body.prompt,
      created_at: new Date().toISOString(),
    };

    const assistantMessage: AIMessage = {
      id: `msg-assistant-${Date.now()}`,
      session_id: sessionId,
      role: "assistant",
      content:
        "This is a mock response to your question. In a real environment, this would be an AI-generated answer based on your inventory data.",
      tool_calls: [
        {
          id: "call-mock",
          type: "function",
          function: {
            name: "search_items",
            arguments: '{"query":"test"}',
          },
        },
      ],
      created_at: new Date().toISOString(),
    };

    return HttpResponse.json({
      session_id: sessionId,
      new_messages: [userMessage, assistantMessage],
      tools_used: ["search_items"],
      credits_used: 1,
    });
  }),
];
