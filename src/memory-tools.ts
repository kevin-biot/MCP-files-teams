// Memory tools integration for existing filesystem server
// Add these to your existing index.ts file

import { ChromaMemoryManager, extractTags, extractContext } from './memory-extension.js';
import type { ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import path from 'path';

// Initialize memory manager
let memoryManager: ChromaMemoryManager | null = null;

// Function to initialize memory manager
export async function initializeMemoryManager(allowedDirectories: string[]) {
  const memoryDir = path.join(allowedDirectories[0], '.mcp-memory');
  memoryManager = new ChromaMemoryManager(memoryDir);
  // Force initialization immediately to see any errors
  await memoryManager.initialize();
}

// Memory tools to add to your existing tools array
export const memoryTools: Array<{
  name: string;
  description: string;
  inputSchema: any;
}> = [
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
        },
        visibility: {
          type: "string",
          description: "Visibility: private | team | public",
          default: "team"
        },
        target: {
          type: "string",
          description: "Where to store: local | team | both",
          default: "both"
        }
      },
      required: ["sessionId", "userMessage", "assistantResponse"]
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
    }
  },
  {
    name: "list_memory_sessions",
    description: "List all available conversation sessions",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "reload_memories_from_json",
    description: "Bulk reload all existing JSON memories into ChromaDB for vector search",
    inputSchema: {
      type: "object",
      properties: {}
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
    }
  },
  {
    name: "memory_status",
    description: "Check memory system status and configuration",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

// Memory tool handlers to add to your existing tool handler switch statement
export async function handleMemoryTool(name: string, args: any) {
  if (!memoryManager) {
    throw new Error("Memory manager not initialized");
  }

  switch (name) {
    case "store_conversation_memory":
      {
        let tags = args.tags || [];
        let context = args.context || [];
        
        // Auto-extract tags and context if requested - fix function calls
        if (args.autoExtract !== false) {
          const combinedText = `${args.userMessage} ${args.assistantResponse}`;
          const autoTags = extractTags(combinedText);
          const autoContext = extractContext(combinedText);
          tags = [...new Set([...tags, ...autoTags])];
          context = [...new Set([...context, ...autoContext])];
        }

        const success = await memoryManager.storeConversation({
          sessionId: args.sessionId,
          userMessage: args.userMessage,
          assistantResponse: args.assistantResponse,
          context,
          tags,
          timestamp: Date.now()
        });
        
        return {
          content: [{
            type: "text",
            text: success 
              ? `✓ Memory stored for session '${args.sessionId}' with ${tags.length} tags and ${context.length} context items`
              : "✗ Failed to store conversation memory"
          }]
        };
      }

    case "search_conversation_memory":
      {
        const results = await memoryManager.searchRelevantMemories(
          args.query,
          args.sessionId,
          args.limit
        );
        
        if (results.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No relevant memories found for your query."
            }]
          };
        }

        const formattedResults = results.map((result, idx) => 
          `**Result ${idx + 1}** (relevance: ${(1 - result.distance).toFixed(2)})\n${result.content}\n---`
        ).join('\n\n');

        return {
          content: [{
            type: "text",
            text: `Found ${results.length} relevant memories:\n\n${formattedResults}`
          }]
        };
      }

    case "get_session_context":
      {
        const summary = await memoryManager.getSessionSummary(args.sessionId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(summary, null, 2)
          }]
        };
      }

    case "build_context_prompt":
      {
        const contextPrompt = await memoryManager.buildContextPrompt(
          args.currentMessage,
          args.sessionId,
          args.maxContextLength
        );
        
        return {
          content: [{
            type: "text",
            text: contextPrompt
          }]
        };
      }

    case "list_memory_sessions":
      {
        const sessions = await memoryManager.getAllSessions();
        return {
          content: [{
            type: "text",
            text: sessions.length > 0 
              ? `Available sessions:\n${sessions.map((s: string) => `• ${s}`).join('\n')}`
              : "No conversation sessions found."
          }]
        };
      }

    case "reload_memories_from_json":
      {
        const result = await memoryManager.reloadAllMemoriesFromJson();
        return {
          content: [{
            type: "text",
            text: `🔄 Bulk reload completed!\n\n• Memories loaded: ${result.loaded}\n• Errors: ${result.errors}\n\nAll existing JSON memories are now available for fast vector search in ChromaDB.`
          }]
        };
      }

    case "delete_memory_session":
      {
        await memoryManager.deleteSession(args.sessionId);
        return {
          content: [{
            type: "text",
            text: `✓ Session '${args.sessionId}' deleted successfully`
          }]
        };
      }

    case "memory_status":
      {
        const isAvailable = await memoryManager.isAvailable();
        const sessions = await memoryManager.getAllSessions();
        
        return {
          content: [{
            type: "text",
            text: `Memory System Status:
• Chroma DB: ${isAvailable ? '✓ Connected' : '✗ Not available (using JSON fallback)'}
• Active Sessions: ${sessions.length}
• Memory Directory: ${(memoryManager as any).memoryDir}
• Vector Search: ${isAvailable ? 'Enabled' : 'Disabled (keyword search only)'}

${!isAvailable ? 'Note: To enable vector search, start Chroma DB with: docker run -p 8000:8000 chromadb/chroma' : ''}`
          }]
        };
      }

    default:
      throw new Error(`Unknown memory tool: ${name}`);
  }
}
