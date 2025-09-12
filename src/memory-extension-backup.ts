import { ChromaClient } from 'chromadb';
import { promises as fs } from 'fs';
import path from 'path';

export interface ConversationMemory {
  sessionId: string;
  timestamp: number;
  userMessage: string;
  assistantResponse: string;
  context: string[];
  tags: string[];
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
    // Try ChromaDB server connection with correct base URL
    try {
      // Connect to ChromaDB HTTP server (use full URL)
      this.client = new ChromaClient({
        path: "http://127.0.0.1:8000"
      });
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
          // Initialize or get existing collection
          this.collection = await this.client.getCollection({
            name: "llm_conversation_memory"
          });
        } catch (error) {
          this.collection = await this.client.createCollection({
            name: "llm_conversation_memory",
            metadata: { "hnsw:space": "cosine" }
          });
        }
        console.error("✓ Chroma memory manager initialized with vector search");
      } else {
        console.error("✓ Memory manager initialized (JSON-only mode)");
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
    
    if (!this.client || !this.collection) {
      // Fall back to JSON-only storage
      return this.storeConversationToJson(memory);
    }

    try {
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

      // Also save to JSON for backup
      await this.storeConversationToJson(memory);
      return true;
    } catch (error) {
      console.error("Failed to store in Chroma:", error);
      return this.storeConversationToJson(memory);
    }
  }

  private async storeConversationToJson(memory: ConversationMemory): Promise<boolean> {
    try {
      const jsonFile = path.join(this.memoryDir, `${memory.sessionId}.json`);
      let conversations = [];
      
      try {
        const existing = await fs.readFile(jsonFile, 'utf-8');
        conversations = JSON.parse(existing);
      } catch (error) {
        // File doesn't exist yet
      }
      
      conversations.push(memory);
      await fs.writeFile(jsonFile, JSON.stringify(conversations, null, 2));
      return true;
    } catch (error) {
      console.error("Failed to store to JSON:", error);
      return false;
    }
  }

  async searchRelevantMemories(query: string, sessionId?: string, limit: number = 5): Promise<MemorySearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.client || !this.collection) {
      // Fall back to JSON search
      return this.searchJsonMemories(query, sessionId, limit);
    }

    try {
      const searchResults = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
        where: sessionId ? { sessionId: sessionId } : undefined
      });

      return searchResults.documents[0].map((doc: string, idx: number) => ({
        content: doc,
        metadata: searchResults.metadatas[0][idx],
        distance: searchResults.distances ? searchResults.distances[0][idx] : 0
      }));
    } catch (error) {
      console.error("Chroma search failed:", error);
      return this.searchJsonMemories(query, sessionId, limit);
    }
  }

  private async searchJsonMemories(query: string, sessionId?: string, limit: number = 5): Promise<MemorySearchResult[]> {
    try {
      const files = await fs.readdir(this.memoryDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      if (sessionId) {
        const sessionFile = `${sessionId}.json`;
        if (jsonFiles.includes(sessionFile)) {
          return this.searchInJsonFile(path.join(this.memoryDir, sessionFile), query, limit);
        }
        return [];
      }

      // Search across all files
      let allResults: MemorySearchResult[] = [];
      
      for (const file of jsonFiles.slice(0, 10)) { // Limit to recent files
        const results = await this.searchInJsonFile(path.join(this.memoryDir, file), query, limit);
        allResults.push(...results);
      }

      // Simple relevance scoring based on keyword matches
      allResults.sort((a, b) => b.distance - a.distance);
      return allResults.slice(0, limit);
    } catch (error) {
      console.error("JSON search failed:", error);
      return [];
    }
  }

  private async searchInJsonFile(filePath: string, query: string, limit: number): Promise<MemorySearchResult[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const conversations = JSON.parse(content);
      
      const queryLower = query.toLowerCase();
      const results: MemorySearchResult[] = [];

      for (const conv of conversations) {
        const searchText = `${conv.userMessage} ${conv.assistantResponse}`.toLowerCase();
        const contextText = conv.context?.join(' ').toLowerCase() || '';
        const tagsText = conv.tags?.join(' ').toLowerCase() || '';
        
        let score = 0;
        if (searchText.includes(queryLower)) score += 3;
        if (contextText.includes(queryLower)) score += 2;
        if (tagsText.includes(queryLower)) score += 1;
        
        if (score > 0) {
          results.push({
            content: `User: ${conv.userMessage}\nAssistant: ${conv.assistantResponse}`,
            metadata: conv,
            distance: score
          });
        }
      }

      results.sort((a, b) => b.distance - a.distance);
      return results.slice(0, limit);
    } catch (error) {
      return [];
    }
  }

  async getSessionSummary(sessionId: string): Promise<string> {
    const memories = await this.searchRelevantMemories("", sessionId, 50);
    
    if (memories.length === 0) {
      return "No previous conversation history found.";
    }

    // Extract key topics and patterns
    const topics = new Set<string>();
    const keyFacts = new Set<string>();
    
    memories.forEach(memory => {
      if (memory.metadata.tags) {
        memory.metadata.tags.split(', ').forEach((tag: string) => topics.add(tag));
      }
      if (memory.metadata.context) {
        memory.metadata.context.split(', ').forEach((fact: string) => keyFacts.add(fact));
      }
    });

    return `
Previous conversation summary for session ${sessionId}:
Topics discussed: ${Array.from(topics).join(', ')}
Key facts: ${Array.from(keyFacts).slice(0, 10).join(', ')}
Conversation count: ${memories.length}
    `.trim();
  }

  async getAllSessions(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.memoryDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (error) {
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Delete from Chroma if available
    if (this.initialized) {
      try {
        const results = await this.collection.get({
          where: { sessionId: sessionId }
        });
        
        if (results.ids.length > 0) {
          await this.collection.delete({
            ids: results.ids
          });
        }
      } catch (error) {
        console.error('Failed to delete from Chroma:', error);
      }
    }

    // Delete JSON backup
    const jsonFile = path.join(this.memoryDir, `${sessionId}.json`);
    try {
      await fs.unlink(jsonFile);
    } catch (error) {
      // File might not exist
    }
  }

  async buildContextPrompt(currentMessage: string, sessionId: string, maxLength: number = 2000): Promise<string> {
    const relevantMemories = await this.searchRelevantMemories(currentMessage, sessionId, 3);
    const sessionSummary = await this.getSessionSummary(sessionId);
    
    let contextPrompt = `## Previous Context\n${sessionSummary}\n\n`;
    
    if (relevantMemories.length > 0) {
      contextPrompt += `## Relevant Previous Exchanges\n`;
      relevantMemories.forEach((memory, idx) => {
        contextPrompt += `${idx + 1}. ${memory.content}\n\n`;
      });
    }
    
    contextPrompt += `## Current Message\n${currentMessage}`;
    
    // Truncate if too long
    if (contextPrompt.length > maxLength) {
      contextPrompt = contextPrompt.substring(0, maxLength) + "...";
    }
    
    return contextPrompt;
  }
}

// Helper function to extract useful tags from text
export function extractTags(userMessage: string, assistantResponse: string): string[] {
  const text = `${userMessage} ${assistantResponse}`.toLowerCase();
  const tags: string[] = [];
  
  // Technical terms
  const techTerms = ['docker', 'kubernetes', 'java', 'python', 'javascript', 'typescript', 'react', 'node', 'npm', 'git', 'github', 'deployment', 'devops', 'ci/cd', 'testing', 'database', 'api', 'rest', 'graphql', 'aws', 'azure', 'gcp', 'linux', 'ubuntu', 'nginx', 'apache', 'mysql', 'postgresql', 'mongodb', 'redis'];
  
  techTerms.forEach(term => {
    if (text.includes(term)) {
      tags.push(term);
    }
  });
  
  // Action-based tags
  if (text.includes('error') || text.includes('bug') || text.includes('fix')) {
    tags.push('troubleshooting');
  }
  if (text.includes('deploy') || text.includes('build') || text.includes('release')) {
    tags.push('deployment');
  }
  if (text.includes('config') || text.includes('setup') || text.includes('install')) {
    tags.push('configuration');
  }
  if (text.includes('test') || text.includes('spec')) {
    tags.push('testing');
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

// Helper function to extract context from messages
export function extractContext(userMessage: string, assistantResponse: string): string[] {
  const context: string[] = [];
  
  // Extract file paths
  const pathRegex = /[\w\/\\-]+\.[\w]+/g;
  const paths = [...userMessage.matchAll(pathRegex), ...assistantResponse.matchAll(pathRegex)];
  paths.forEach(match => context.push(`file: ${match[0]}`));
  
  // Extract URLs
  const urlRegex = /https?:\/\/[\w\.-]+/g;
  const urls = [...userMessage.matchAll(urlRegex), ...assistantResponse.matchAll(urlRegex)];
  urls.forEach(match => context.push(`url: ${match[0]}`));
  
  // Extract commands (simple heuristic)
  const commandRegex = /`([^`]+)`/g;
  const commands = [...userMessage.matchAll(commandRegex), ...assistantResponse.matchAll(commandRegex)];
  commands.forEach(match => {
    if (match[1].length < 50) { // Only short commands
      context.push(`command: ${match[1]}`);
    }
  });
  
  return context;
}