// KnowledgeToolsSuite - Memory tools wrapped in ToolSuite interface
// Implements ToolSuite for consistency with UnifiedToolRegistry

import { ToolSuite, StandardTool } from '../../types.js';
import { handleMemoryTool } from '../../memory-tools.js';

export class KnowledgeToolsSuite implements ToolSuite {
  category = 'memory';
  version = '2.0';

  getTools(): StandardTool[] {
    return [
      {
        name: "store_conversation_memory",
        description: "Store a conversation exchange in vector memory for future retrieval",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Unique session identifier" },
            userMessage: { type: "string", description: "The user's message" },
            assistantResponse: { type: "string", description: "The assistant's response" },
            context: { 
              type: "array", 
              items: { type: "string" },
              description: "Additional context items (optional)",
              default: []
            },
            tags: { 
              type: "array", 
              items: { type: "string" },
              description: "Tags for categorizing this memory (optional)",
              default: []
            },
            autoExtract: {
              type: "boolean",
              description: "Automatically extract tags and context from messages",
              default: true
            }
          },
          required: ["sessionId", "userMessage", "assistantResponse"]
        },
        execute: async (args: any) => {
          const result = await handleMemoryTool("store_conversation_memory", args);
          return JSON.stringify(result, null, 2);
        }
      },
      {
        name: "search_conversation_memory",
        description: "Search previous conversations for relevant context using vector similarity",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            sessionId: { type: "string", description: "Optional: limit search to specific session" },
            limit: { type: "number", description: "Maximum results to return", default: 5 }
          },
          required: ["query"]
        },
        execute: async (args: any) => {
          const result = await handleMemoryTool("search_conversation_memory", args);
          return JSON.stringify(result, null, 2);
        }
      },
      {
        name: "get_session_context",
        description: "Get contextual summary of a conversation session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session identifier" }
          },
          required: ["sessionId"]
        },
        execute: async (args: any) => {
          const result = await handleMemoryTool("get_session_context", args);
          return JSON.stringify(result, null, 2);
        }
      },
      {
        name: "build_context_prompt",
        description: "Build an enhanced prompt with relevant memory context for LM Studio",
        inputSchema: {
          type: "object",
          properties: {
            currentMessage: { type: "string", description: "The current user message" },
            sessionId: { type: "string", description: "Session identifier" },
            maxContextLength: { type: "number", description: "Maximum context length", default: 2000 }
          },
          required: ["currentMessage", "sessionId"]
        },
        execute: async (args: any) => {
          const result = await handleMemoryTool("build_context_prompt", args);
          return JSON.stringify(result, null, 2);
        }
      },
      {
        name: "list_memory_sessions",
        description: "List all available conversation sessions",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        },
        execute: async (args: any) => {
          const result = await handleMemoryTool("list_memory_sessions", args);
          return JSON.stringify(result, null, 2);
        }
      },
      {
        name: "delete_memory_session",
        description: "Delete all memories for a specific session",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Session identifier to delete" }
          },
          required: ["sessionId"]
        },
        execute: async (args: any) => {
          const result = await handleMemoryTool("delete_memory_session", args);
          return JSON.stringify(result, null, 2);
        }
      },
      {
        name: "memory_status",
        description: "Check memory system status and configuration",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        },
        execute: async (args: any) => {
          const result = await handleMemoryTool("memory_status", args);
          return JSON.stringify(result, null, 2);
        }
      }
    ];
  }
}

// Export singleton instance
export const knowledgeToolsSuite = new KnowledgeToolsSuite();
