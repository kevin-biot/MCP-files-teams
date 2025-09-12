import { ChromaClient } from 'chromadb';
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';
import { promises as fs } from 'fs';
import path from 'path';

export enum KnowledgeSourceClass {
  USER_PROVIDED = 'user_provided',
  ENGINEER_ADDED = 'engineer_added',
  SYSTEM_GENERATED = 'system_generated',
  EXTERNAL_API = 'external_api',
  DOCUMENT_PARSED = 'document_parsed'
}

export interface ConversationMemory {
  sessionId: string;
  timestamp: number;
  userMessage: string;
  assistantResponse: string;
  context: string[];
  tags: string[];
  source?: KnowledgeSourceClass;
}

export interface MemorySearchResult {
  content: string;
  metadata: any;
  distance: number;
}

export class ChromaMemoryManager {
  private client: ChromaClient | null;
  private collection: any;
  private memoryDir: string;
  private initialized = false;

  constructor(memoryDir: string) {
    this.memoryDir = memoryDir;
    
    try {
      // Connect to ChromaDB HTTP server with embedding function
      this.client = new ChromaClient({
        host: "127.0.0.1",
        port: 8000
      });
      
      console.log("✓ ChromaDB client initialized");
    } catch (error) {
      console.error('ChromaDB initialization failed, will use JSON-only mode:', error);
      this.client = null;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure memory directory exists
      await fs.mkdir(this.memoryDir, { recursive: true });

      // Only try ChromaDB if client was successfully created
      if (this.client) {
        try {
          // Try to get existing collection first
          try {
            this.collection = await this.client.getCollection({
              name: "llm_conversation_memory",
              embeddingFunction: new DefaultEmbeddingFunction()
            });
            console.log("✓ Connected to existing ChromaDB collection");
          } catch (getError) {
            console.log("ℹ No existing collection found, creating new one");
            
            // Only create new if collection doesn't exist
            this.collection = await this.client.createCollection({
              name: "llm_conversation_memory",
              embeddingFunction: new DefaultEmbeddingFunction(),
              metadata: {
                "hnsw:space": "cosine"
              }
            });
            console.log("✓ Created new ChromaDB collection with cosine distance");
          }
        } catch (error) {
          console.error("ChromaDB collection creation failed:", error);
          throw error;
        }
        console.log("✓ Chroma memory manager initialized with vector search");
      } else {
        console.log("✓ Memory manager initialized (JSON-only mode)");
      }

      this.initialized = true;
    } catch (error) {
      console.error("✗ ChromaDB failed, using JSON-only mode:", error);
      this.client = null;
      this.collection = null;
      this.initialized = true; // Still consider it initialized, just without ChromaDB
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.initialized && this.client !== null && this.collection !== null;
  }

  async storeConversation(memory: ConversationMemory): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Always store to JSON as backup
    await this.storeConversationToJson(memory);
    
    if (!this.client || !this.collection) {
      return true; // JSON storage succeeded
    }

    try {
      const id = `${memory.sessionId}_${memory.timestamp}`;
      const document = `User: ${memory.userMessage}\nAssistant: ${memory.assistantResponse}`;
      
      console.log('💾 Storing to ChromaDB:', {
        id,
        documentLength: document.length,
        sessionId: memory.sessionId
      });
      
      // For ChromaDB server mode, it will generate embeddings automatically
      await this.collection.add({
        ids: [id],
        documents: [document],
        metadatas: [{
          sessionId: memory.sessionId,
          timestamp: memory.timestamp,
          userMessage: memory.userMessage,
          assistantResponse: memory.assistantResponse,
          context: memory.context.join(', '),
          tags: memory.tags.join(', ')
        }]
      });
      
      console.log('✅ Successfully stored to ChromaDB');
      return true;
    } catch (error) {
      console.error('ChromaDB storage failed, but JSON backup succeeded:', error);
      return true; // JSON storage is still working
    }
  }

  async storeConversationToJson(memory: ConversationMemory): Promise<boolean> {
    try {
      const sessionFile = path.join(this.memoryDir, `${memory.sessionId}.json`);
      
      let existingData: ConversationMemory[] = [];
      try {
        const content = await fs.readFile(sessionFile, 'utf8');
        existingData = JSON.parse(content);
      } catch (error) {
        // File doesn't exist or is invalid, start with empty array
      }
      
      existingData.push(memory);
      
      await fs.writeFile(sessionFile, JSON.stringify(existingData, null, 2));
      return true;
    } catch (error) {
      console.error('JSON storage failed:', error);
      return false;
    }
  }

  async searchRelevantMemories(query: string, sessionId?: string, limit: number = 5): Promise<MemorySearchResult[]> {
    console.log(`🔍 Searching for: "${query}" (sessionId: ${sessionId || 'all'}, limit: ${limit})`);
    
    // First try vector search
    if (this.collection && this.client) {
      try {
        console.log('📊 Attempting ChromaDB vector search...');
        const results = await this.collection.query({
          queryTexts: [query],
          nResults: limit,
          where: sessionId ? { sessionId } : undefined
        });

        console.log('✅ ChromaDB search successful:', {
          documentsCount: results.documents[0]?.length || 0,
          hasDistances: !!results.distances[0],
          distances: results.distances[0]?.slice(0, 3), // Show first 3 distances
          distanceRange: results.distances[0] ? {
            min: Math.min(...results.distances[0]),
            max: Math.max(...results.distances[0])
          } : null
        });

        if (results.documents[0] && results.documents[0].length > 0) {
          return results.documents[0].map((doc: string, index: number) => ({
            content: doc,
            metadata: results.metadatas[0][index],
            distance: results.distances[0][index]
          }));
        } else {
          console.log('⚠️ ChromaDB returned no results, falling back to JSON search');
        }
      } catch (error) {
        console.error('❌ Chroma search failed, falling back to JSON search:', error);
      }
    } else {
      console.log('⚠️ ChromaDB not available, using JSON search directly');
    }

    // Fallback to JSON search
    console.log('📄 Using JSON search fallback...');
    const jsonResults = await this.searchJsonMemories(query, sessionId, limit);
    console.log(`📄 JSON search returned ${jsonResults.length} results`);
    return jsonResults;
  }

  async searchJsonMemories(query: string, sessionId?: string, limit: number = 5): Promise<MemorySearchResult[]> {
    try {
      const results: MemorySearchResult[] = [];
      const queryLower = query.toLowerCase();
      
      // Read all session files or specific session
      const files = sessionId 
        ? [`${sessionId}.json`]
        : await fs.readdir(this.memoryDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filePath = path.join(this.memoryDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const memories: ConversationMemory[] = JSON.parse(content);
          
          for (const memory of memories) {
            const searchText = `${memory.userMessage} ${memory.assistantResponse} ${memory.tags.join(' ')}`.toLowerCase();
            
            if (searchText.includes(queryLower)) {
              results.push({
                content: `User: ${memory.userMessage}\nAssistant: ${memory.assistantResponse}`,
                metadata: {
                  sessionId: memory.sessionId,
                  timestamp: memory.timestamp,
                  tags: memory.tags,
                  context: memory.context
                },
                distance: 0.5 // Dummy distance for JSON search
              });
            }
          }
        } catch (error) {
          // Skip invalid files
          continue;
        }
      }
      
      return results.slice(0, limit);
    } catch (error) {
      console.error('JSON search failed:', error);
      return [];
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.memoryDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }

  async getAllSessions(): Promise<string[]> {
    return this.listSessions();
  }

  async getSessionSummary(sessionId: string): Promise<any> {
    try {
      // Try to get from vector search first
      if (this.collection) {
        const results = await this.searchRelevantMemories("", sessionId, 10);
        if (results.length > 0) {
          return {
            sessionId,
            conversationCount: results.length,
            recentMemories: results.slice(0, 3)
          };
        }
      }
      
      // Fallback to JSON
      const sessionFile = path.join(this.memoryDir, `${sessionId}.json`);
      const content = await fs.readFile(sessionFile, 'utf8');
      const memories: ConversationMemory[] = JSON.parse(content);
      
      return {
        sessionId,
        conversationCount: memories.length,
        tags: [...new Set(memories.flatMap(m => m.tags))],
        context: [...new Set(memories.flatMap(m => m.context))],
        timeRange: {
          earliest: Math.min(...memories.map(m => m.timestamp)),
          latest: Math.max(...memories.map(m => m.timestamp))
        }
      };
    } catch (error) {
      console.error(`Failed to get session summary for ${sessionId}:`, error);
      return null;
    }
  }

  async buildContextPrompt(currentMessage: string, sessionId?: string, maxLength: number = 2000): Promise<string> {
    try {
      const relevantMemories = await this.searchRelevantMemories(currentMessage, sessionId, 3);
      
      if (relevantMemories.length === 0) {
        return "";
      }
      
      let context = "## Relevant Context from Previous Conversations:\n\n";
      let currentLength = context.length;
      
      for (const memory of relevantMemories) {
        const addition = `### ${memory.metadata.sessionId || 'Session'}\n${memory.content}\n\n`;
        if (currentLength + addition.length > maxLength) {
          break;
        }
        context += addition;
        currentLength += addition.length;
      }
      
      return context;
    } catch (error) {
      console.error('Failed to build context prompt:', error);
      return "";
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sessionFile = path.join(this.memoryDir, `${sessionId}.json`);
      await fs.unlink(sessionFile);
      
      // TODO: Also delete from ChromaDB if available
      
      return true;
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }

  async reloadAllMemoriesFromJson(): Promise<{ loaded: number, errors: number }> {
    if (!this.collection) {
      console.error('ChromaDB not available for reload');
      return { loaded: 0, errors: 0 };
    }

    try {
      const sessionFiles = await fs.readdir(this.memoryDir);
      let loaded = 0;
      let errors = 0;
      
      console.log(`🔄 Starting bulk reload of ${sessionFiles.length} session files into ChromaDB...`);
      
      for (const file of sessionFiles) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filePath = path.join(this.memoryDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const memories: ConversationMemory[] = JSON.parse(content);
          
          for (const memory of memories) {
            const id = `${memory.sessionId}_${memory.timestamp}`;
            const document = `User: ${memory.userMessage}\nAssistant: ${memory.assistantResponse}`;
            
            await this.collection.add({
              ids: [id],
              documents: [document],
              metadatas: [{
                sessionId: memory.sessionId,
                timestamp: memory.timestamp,
                userMessage: memory.userMessage,
                assistantResponse: memory.assistantResponse,
                context: memory.context.join(', '),
                tags: memory.tags.join(', ')
              }]
            });
            
            loaded++;
          }
          
          console.log(`✓ Loaded ${memories.length} memories from ${file}`);
        } catch (error) {
          console.error(`✗ Failed to load ${file}:`, error);
          errors++;
        }
      }
      
      console.log(`🎉 Bulk reload complete: ${loaded} memories loaded, ${errors} errors`);
      return { loaded, errors };
    } catch (error) {
      console.error('Bulk reload failed:', error);
      return { loaded: 0, errors: 1 };
    }
  }
}

// Utility functions - fix to match expected signatures
export function extractTags(text: string): string[] {
  const commonTags = [
    'javascript', 'typescript', 'python', 'react', 'node', 'docker', 
    'kubernetes', 'aws', 'database', 'api', 'frontend', 'backend',
    'deployment', 'security', 'performance', 'testing', 'debugging',
    'configuration', 'integration', 'authentication', 'monitoring'
  ];
  
  const textLower = text.toLowerCase();
  return commonTags.filter(tag => textLower.includes(tag));
}

export function extractContext(text: string): string[] {
  const context: string[] = [];
  
  // Extract file references
  const fileRegex = /(?:file:|filename:|path:)\s*([^\s,]+)/gi;
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    context.push(`file: ${match[1]}`);
  }
  
  // Extract URLs
  const urlRegex = /https?:\/\/[^\s,]+/gi;
  while ((match = urlRegex.exec(text)) !== null) {
    context.push(`url: ${match[0]}`);
  }
  
  return [...new Set(context)];
}
