// Integration test for UnifiedToolRegistry
// Verify all tool suites work correctly

import { toolRegistry } from './lib/tools/tool-registry.js';
import { knowledgeToolsSuite } from './tools/memory/knowledge-tools-suite.js';
import { diagnosticToolsV2Suite } from './tools/diagnostics/v2-suite.js';

export async function initializeUnifiedRegistry(): Promise<void> {
  console.log('🚀 Initializing Unified Tool Registry...');
  
  try {
    // Register memory tools suite
    toolRegistry.registerSuite(knowledgeToolsSuite);
    console.log('✅ Knowledge Tools Suite registered');
    
    // Register V2 diagnostic tools suite
    toolRegistry.registerSuite(diagnosticToolsV2Suite);
    console.log('✅ Diagnostic Tools V2 Suite registered');
    
    // Display registry statistics
    console.log('\n' + toolRegistry.getRegistryStatistics());
    
    // List all available tools
    const tools = toolRegistry.listTools();
    console.log(`\n📋 Available tools: ${tools.join(', ')}`);
    
    console.log('\n🎉 Unified Tool Registry initialized successfully!');
    
  } catch (error) {
    console.error('❌ Failed to initialize Unified Tool Registry:', error);
    throw error;
  }
}

export async function testToolExecution(): Promise<void> {
  console.log('\n🧪 Testing tool execution...');
  
  try {
    // Test V2 diagnostic tool
    const healthResult = await toolRegistry.executeTool('checkNamespaceHealthV2', {
      namespace: 'test-namespace',
      detailedAnalysis: true
    });
    console.log('✅ checkNamespaceHealthV2 executed successfully');
    console.log('Sample output:', healthResult.substring(0, 100) + '...');
    
    // Test memory tool
    const memoryResult = await toolRegistry.executeTool('memory_status', {});
    console.log('✅ memory_status executed successfully');
    
    console.log('\n🎉 All tool executions successful!');
    
  } catch (error) {
    console.error('❌ Tool execution test failed:', error);
    throw error;
  }
}

// Export for use in main server
export { toolRegistry };
