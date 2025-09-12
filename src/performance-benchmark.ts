// Enhanced Performance Benchmarking System for MCP Server
// This provides detailed metrics for comparing LLM performance on tool usage

interface ToolCallMetric {
  toolName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  inputSize: number;
  outputSize: number;
  sessionId?: string;
  llmModel?: string;
  timestamp: string;
}

interface SessionMetrics {
  sessionId: string;
  llmModel?: string;
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  successRate: number;
  toolBreakdown: { [toolName: string]: ToolStats };
  startTime: number;
  endTime: number;
}

interface ToolStats {
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  errors: string[];
}

class PerformanceBenchmark {
  private metrics: ToolCallMetric[] = [];
  private currentCalls: Map<string, { toolName: string; startTime: number; inputSize: number }> = new Map();
  private sessionId: string = '';
  private llmModel: string = '';

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  setLLMModel(model: string) {
    this.llmModel = model;
    console.log(`🤖 LLM model set to: ${model} (session: ${this.sessionId.slice(-6)})`);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startTool(toolName: string, input: any): string {
    const callId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const inputSize = JSON.stringify(input).length;
    
    this.currentCalls.set(callId, {
      toolName,
      startTime: performance.now(),
      inputSize
    });

    const time = new Date().toLocaleTimeString();
    console.log(`🚀 [${time}] ${toolName} started (input: ${inputSize} chars, session: ${this.sessionId.slice(-6)})`);
    
    return callId;
  }

  endTool(callId: string, output: any, error?: Error): ToolCallMetric | null {
    const callData = this.currentCalls.get(callId);
    if (!callData) {
      console.warn(`⚠️ No start data found for call ID: ${callId}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - callData.startTime;
    const outputSize = JSON.stringify(output).length;
    const success = !error;

    const metric: ToolCallMetric = {
      toolName: callData.toolName,
      startTime: callData.startTime,
      endTime,
      duration,
      success,
      error: error?.message,
      inputSize: callData.inputSize,
      outputSize,
      sessionId: this.sessionId,
      llmModel: this.llmModel,
      timestamp: new Date().toISOString()
    };

    this.metrics.push(metric);
    this.currentCalls.delete(callId);

    const time = new Date().toLocaleTimeString();
    const statusIcon = success ? '✅' : '❌';
    const durationFormatted = duration < 1000 ? `${duration.toFixed(1)}ms` : `${(duration/1000).toFixed(2)}s`;
    const efficiencyIcon = this.getToolEfficiencyRating(duration);
    
    console.log(`${statusIcon} [${time}] ${callData.toolName} completed in ${durationFormatted} ${efficiencyIcon} (${outputSize} chars output)`);

    if (duration > 5000) {
      console.log(`⚠️ Slow tool detected: ${callData.toolName} took ${durationFormatted} - consider optimizing for ${this.llmModel || 'this LLM'}`);
    }

    return metric;
  }

  private getToolEfficiencyRating(avgDuration: number): string {
    if (avgDuration < 100) return '🚀';
    if (avgDuration < 500) return '⚡';
    if (avgDuration < 1000) return '✅';
    if (avgDuration < 3000) return '⚠️';
    return '🐌';
  }

  generateReport(includeComparison: boolean = false): string {
    const currentStats = this.getCurrentSessionStats();
    
    let report = `
📊 LLM Performance Benchmark Report
═══════════════════════════════════

🤖 LLM Model: ${currentStats.llmModel || 'Unknown'}
🔧 Session: ${currentStats.sessionId.slice(-8)}
📅 Duration: ${((currentStats.endTime - currentStats.startTime) / 1000 / 60).toFixed(1)} minutes

📈 Overall Performance:
• Total Tool Calls: ${currentStats.totalCalls}
• Average Response Time: ${currentStats.averageDuration.toFixed(1)}ms
• Success Rate: ${(currentStats.successRate * 100).toFixed(1)}%
• Total Execution Time: ${(currentStats.totalDuration / 1000).toFixed(2)}s
• Tool Efficiency Score: ${this.calculateEfficiencyScore(currentStats).toFixed(1)}/100

🛠️ Tool Performance Breakdown:
`;

    Object.entries(currentStats.toolBreakdown)
      .sort(([,a], [,b]) => b.averageDuration - a.averageDuration)
      .forEach(([toolName, stats]) => {
        const avgMs = stats.averageDuration.toFixed(1);
        const minMs = stats.minDuration.toFixed(1);
        const maxMs = stats.maxDuration.toFixed(1);
        const successPercent = (stats.successRate * 100).toFixed(1);
        const efficiencyRating = this.getToolEfficiencyRating(stats.averageDuration);
        
        report += `
• ${toolName}: ${efficiencyRating}
  - Calls: ${stats.count} | Avg: ${avgMs}ms (${minMs}-${maxMs}ms)
  - Success: ${successPercent}% | Total: ${(stats.totalDuration/1000).toFixed(1)}s`;
        
        if (stats.errors.length > 0) {
          report += `
  - Errors: ${stats.errors.slice(0, 2).join(', ')}${stats.errors.length > 2 ? '...' : ''}`;
        }
      });

    report += this.generateLLMInsights(currentStats);

    if (includeComparison) {
      report += this.generateComparisonMetrics();
    }

    return report;
  }

  getCurrentSessionStats(): SessionMetrics {
    const sessionMetrics = this.metrics.filter(m => m.sessionId === this.sessionId);
    
    if (sessionMetrics.length === 0) {
      return {
        sessionId: this.sessionId,
        llmModel: this.llmModel,
        totalCalls: 0,
        totalDuration: 0,
        averageDuration: 0,
        successRate: 0,
        toolBreakdown: {},
        startTime: Date.now(),
        endTime: Date.now()
      };
    }

    const totalDuration = sessionMetrics.reduce((sum, m) => sum + m.duration, 0);
    const successfulCalls = sessionMetrics.filter(m => m.success).length;
    const toolBreakdown: { [toolName: string]: ToolStats } = {};

    sessionMetrics.forEach(metric => {
      if (!toolBreakdown[metric.toolName]) {
        toolBreakdown[metric.toolName] = {
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          successRate: 0,
          errors: []
        };
      }

      const stats = toolBreakdown[metric.toolName];
      stats.count++;
      stats.totalDuration += metric.duration;
      stats.minDuration = Math.min(stats.minDuration, metric.duration);
      stats.maxDuration = Math.max(stats.maxDuration, metric.duration);
      
      if (!metric.success && metric.error) {
        stats.errors.push(metric.error);
      }
    });

    Object.values(toolBreakdown).forEach(stats => {
      stats.averageDuration = stats.totalDuration / stats.count;
      const toolMetrics = sessionMetrics.filter(m => m.toolName === Object.keys(toolBreakdown).find(k => toolBreakdown[k] === stats));
      stats.successRate = toolMetrics.filter(m => m.success).length / stats.count;
    });

    return {
      sessionId: this.sessionId,
      llmModel: this.llmModel,
      totalCalls: sessionMetrics.length,
      totalDuration,
      averageDuration: totalDuration / sessionMetrics.length,
      successRate: successfulCalls / sessionMetrics.length,
      toolBreakdown,
      startTime: Math.min(...sessionMetrics.map(m => m.startTime)),
      endTime: Math.max(...sessionMetrics.map(m => m.endTime))
    };
  }

  private calculateEfficiencyScore(stats: SessionMetrics): number {
    if (stats.totalCalls === 0) return 0;
    
    const speedScore = Math.max(0, 100 - (stats.averageDuration / 100));
    const reliabilityScore = stats.successRate * 100;
    const consistencyScore = this.calculateConsistencyScore(stats);
    
    return (speedScore * 0.4 + reliabilityScore * 0.4 + consistencyScore * 0.2);
  }

  private calculateConsistencyScore(stats: SessionMetrics): number {
    const durations = Object.values(stats.toolBreakdown).map(t => t.averageDuration);
    if (durations.length === 0) return 100;
    
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, 100 - (stdDev / mean) * 100);
  }

  private generateLLMInsights(stats: SessionMetrics): string {
    let insights = '\n\n🧠 LLM Performance Insights:\n';
    
    const slowestTool = Object.entries(stats.toolBreakdown)
      .sort(([,a], [,b]) => b.averageDuration - a.averageDuration)[0];
    
    const fastestTool = Object.entries(stats.toolBreakdown)
      .sort(([,a], [,b]) => a.averageDuration - b.averageDuration)[0];

    if (slowestTool) {
      insights += `• Slowest Tool: ${slowestTool[0]} (${slowestTool[1].averageDuration.toFixed(1)}ms avg)\n`;
    }
    
    if (fastestTool) {
      insights += `• Fastest Tool: ${fastestTool[0]} (${fastestTool[1].averageDuration.toFixed(1)}ms avg)\n`;
    }

    if (stats.averageDuration > 1000) {
      insights += `• ⚠️ This LLM shows slower tool execution - consider optimization\n`;
    } else if (stats.averageDuration < 200) {
      insights += `• 🚀 Excellent response times - this LLM is well-optimized for tool use\n`;
    }

    if (stats.successRate < 0.95) {
      insights += `• ⚠️ Success rate below 95% - may need error handling improvements\n`;
    }

    return insights;
  }

  private generateComparisonMetrics(): string {
    return '\n\n🔍 LLM comparison requires multiple sessions with different models.';
  }

  resetSession() {
    this.sessionId = this.generateSessionId();
    this.currentCalls.clear();
    console.log(`🔄 New performance session started: ${this.sessionId.slice(-8)}`);
  }

  getRealTimeSummary(): string {
    const current = this.getCurrentSessionStats();
    if (current.totalCalls === 0) {
      return '📊 No tool calls in current session';
    }

    const lastTool = this.metrics[this.metrics.length - 1];
    const efficiency = this.calculateEfficiencyScore(current);
    
    return `📊 Session ${current.sessionId.slice(-6)} | ${current.llmModel} | ${current.totalCalls} calls | ${current.averageDuration.toFixed(1)}ms avg | ${efficiency.toFixed(1)} efficiency | Last: ${lastTool?.toolName}`;
  }
}

// Global instance
export const benchmark = new PerformanceBenchmark();

// Usage wrapper
export class BenchmarkWrapper {
  static async wrapTool<T>(toolName: string, args: any, toolFunction: () => Promise<T>): Promise<T> {
    const callId = benchmark.startTool(toolName, args);
    
    try {
      const result = await toolFunction();
      benchmark.endTool(callId, result);
      return result;
    } catch (error) {
      benchmark.endTool(callId, null, error as Error);
      throw error;
    }
  }
  
  static setModel(model: string) {
    benchmark.setLLMModel(model);
  }
  
  static getReport(includeComparison: boolean = true): string {
    return benchmark.generateReport(includeComparison);
  }
  
  static getSummary(): string {
    return benchmark.getRealTimeSummary();
  }
  
  static reset() {
    benchmark.resetSession();
  }
}
