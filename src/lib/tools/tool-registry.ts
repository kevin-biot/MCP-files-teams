// UnifiedToolRegistry - Standardized tool registration and execution system
// Based on previous session's foundation work

import { StandardTool, ToolSuite } from '../../types.js';

export interface ToolRegistrationEntry {
  name: string;
  description: string;
  inputSchema: any;
  suite: ToolSuite;
  tool: StandardTool;
}

export class UnifiedToolRegistry {
  private tools = new Map<string, ToolRegistrationEntry>();
  private suites = new Map<string, ToolSuite>();

  registerSuite(suite: ToolSuite): void {
    const suiteKey = `${suite.category}-${suite.version}`;
    this.suites.set(suiteKey, suite);
    
    // Register all tools from the suite
    const tools = suite.getTools();
    for (const tool of tools) {
      if (this.tools.has(tool.name)) {
        throw new Error(`Tool ${tool.name} already registered`);
      }
      
      this.tools.set(tool.name, {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        suite,
        tool
      });
    }
  }

  async executeTool(name: string, args: any = {}): Promise<string> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      return await entry.tool.execute(args);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error executing ${name}: ${errorMessage}`;
    }
  }

  getMCPTools(): Array<{ name: string; description: string; inputSchema: any }> {
    return Array.from(this.tools.values()).map(entry => ({
      name: entry.name,  // Use 'name' not 'fullName' for MCP compatibility
      description: entry.description,
      inputSchema: entry.inputSchema
    }));
  }

  getRegistryStatistics(): string {
    const toolCount = this.tools.size;
    const suiteCount = this.suites.size;
    const categories = new Set(Array.from(this.suites.values()).map(s => s.category));
    
    return `Registry Statistics:
- ${toolCount} tools registered
- ${suiteCount} tool suites
- ${categories.size} categories: ${Array.from(categories).join(', ')}`;
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}

// Global registry instance
export const toolRegistry = new UnifiedToolRegistry();
