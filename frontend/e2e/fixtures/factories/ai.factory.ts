/**
 * AI Assistant factory for generating test AI session/chat data.
 */

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AIMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCall[];
  created_at: string;
}

export interface AISession {
  id: string;
  title: string;
  message_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AISessionWithMessages extends AISession {
  messages: AIMessage[];
}

export interface AIChatResponse {
  session_id: string;
  new_messages: AIMessage[];
  tools_used: string[];
  credits_used: number;
}

export interface PaginatedSessions {
  sessions: AISession[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

let sessionCounter = 0;
let messageCounter = 0;

export function createAISession(overrides: Partial<AISession> = {}): AISession {
  sessionCounter++;
  return {
    id: `session-${sessionCounter}`,
    title: `Chat ${sessionCounter}`,
    message_count: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createAIMessage(overrides: Partial<AIMessage> = {}): AIMessage {
  messageCounter++;
  return {
    id: `msg-${messageCounter}`,
    session_id: "session-1",
    role: "user",
    content: "Test message",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function resetAIFactory(): void {
  sessionCounter = 0;
  messageCounter = 0;
}

// Pre-built fixtures
export const testAISessions: AISession[] = [
  {
    id: "session-1",
    title: "Organizing garage tools",
    message_count: 5,
    is_active: true,
    created_at: "2024-06-19T10:00:00Z",
    updated_at: "2024-06-19T10:15:00Z",
  },
  {
    id: "session-2",
    title: "Electronics inventory help",
    message_count: 3,
    is_active: true,
    created_at: "2024-06-18T14:30:00Z",
    updated_at: "2024-06-18T14:45:00Z",
  },
  {
    id: "session-3",
    title: "Kitchen storage ideas",
    message_count: 8,
    is_active: true,
    created_at: "2024-06-17T09:20:00Z",
    updated_at: "2024-06-17T10:00:00Z",
  },
];

export const testAISessionMessages: AIMessage[] = [
  {
    id: "msg-1",
    session_id: "session-1",
    role: "user",
    content: "How should I organize my garage tools?",
    created_at: "2024-06-19T10:00:00Z",
  },
  {
    id: "msg-2",
    session_id: "session-1",
    role: "assistant",
    content:
      "I'd recommend organizing your garage tools by frequency of use and category. Here are some tips:\n\n1. Wall-mounted pegboards for frequently used tools\n2. Labeled bins for small items\n3. Heavy-duty shelving for power tools\n\nWould you like me to search your inventory for specific tool categories?",
    tool_calls: [
      {
        id: "call-1",
        type: "function",
        function: {
          name: "search_items",
          arguments: '{"query":"tools","category":"garage"}',
        },
      },
    ],
    created_at: "2024-06-19T10:01:00Z",
  },
  {
    id: "msg-3",
    session_id: "session-1",
    role: "user",
    content: "Yes, show me my power tools",
    created_at: "2024-06-19T10:05:00Z",
  },
  {
    id: "msg-4",
    session_id: "session-1",
    role: "assistant",
    content:
      "I found 3 power tools in your inventory:\n- [Cordless Drill](/items/item-1)\n- [Circular Saw](/items/item-2)\n- [Angle Grinder](/items/item-3)\n\nThese would be great candidates for wall-mounted storage or a dedicated power tool cabinet.",
    tool_calls: [
      {
        id: "call-2",
        type: "function",
        function: {
          name: "list_items",
          arguments: '{"category":"Power Tools","limit":10}',
        },
      },
    ],
    created_at: "2024-06-19T10:06:00Z",
  },
];

export const testAISessionDetail: AISessionWithMessages = {
  id: "session-1",
  title: "Organizing garage tools",
  message_count: 5,
  is_active: true,
  created_at: "2024-06-19T10:00:00Z",
  updated_at: "2024-06-19T10:15:00Z",
  messages: testAISessionMessages.filter((m) => m.session_id === "session-1"),
};

export const testAIChatResponse: AIChatResponse = {
  session_id: "session-1",
  new_messages: [
    {
      id: "msg-new-user",
      session_id: "session-1",
      role: "user",
      content: "What's in my garage?",
      created_at: new Date().toISOString(),
    },
    {
      id: "msg-new-assistant",
      session_id: "session-1",
      role: "assistant",
      content:
        "Based on your inventory, your garage contains:\n- 15 power tools\n- 32 hand tools\n- 8 gardening items\n- Various hardware and supplies",
      tool_calls: [
        {
          id: "call-3",
          type: "function",
          function: {
            name: "search_items",
            arguments: '{"location":"Garage"}',
          },
        },
      ],
      created_at: new Date().toISOString(),
    },
  ],
  tools_used: ["search_items"],
  credits_used: 1,
};

export interface ClassificationResult {
  success: boolean;
  classification?: {
    identified_name: string;
    confidence: number;
    category_path: string;
    description: string;
    specifications: Array<{ key: string; value: string | number }>;
    alternative_suggestions: Array<{ name: string; confidence: number }>;
    quantity_estimate: string;
  };
  create_item_prefill?: {
    name: string;
    description: string;
    quantity: number;
    quantity_unit: string;
    tags: string[];
  };
  error?: string;
}

export const testClassificationResult: ClassificationResult = {
  success: true,
  classification: {
    identified_name: "Arduino Uno R3",
    confidence: 0.95,
    category_path: "Electronics.Microcontrollers",
    description: "Arduino Uno microcontroller board based on ATmega328P",
    specifications: [
      { key: "microcontroller", value: "ATmega328P" },
      { key: "operating_voltage", value: "5V" },
      { key: "digital_io_pins", value: 14 },
      { key: "analog_input_pins", value: 6 },
    ],
    alternative_suggestions: [
      { name: "Arduino Nano", confidence: 0.1 },
      { name: "Arduino Mega", confidence: 0.05 },
    ],
    quantity_estimate: "1 piece",
  },
  create_item_prefill: {
    name: "Arduino Uno R3",
    description: "Arduino Uno microcontroller board based on ATmega328P",
    quantity: 1,
    quantity_unit: "pcs",
    tags: ["arduino", "microcontroller"],
  },
};
