// Enhanced Performance Benchmark with LLM Thinking Time Tracking
// This version tracks gaps between tool calls to measure LLM processing time

import { benchmark } from './performance-benchmark.js';

interface SessionTiming {
  sessionId: string;
  lastCallTime: number;
  totalThinkingTime: number;
  callCount: number;
  sessionStartTime: number;
}

class EnhancedBenchmark {
  private sessionTimings: Map<string, SessionTiming> = new Map();
  private currentSessionId: string = '';

  // Track when a new session starts
  startSession(sessionId: string) {
    this.currentSessionId = sessionId;
    if (!this.sessionTimings.has(sessionId)) {
      this.sessionTimings.set(sessionId, {
        sessionId,
        lastCallTime: performance.now(),
        totalThinkingTime: 0,
        callCount: 0,
        sessionStartTime: performance.now()
      });
      console.log(`🧠 [${new Date().toLocaleTimeString()}] New LLM session started: ${sessionId.slice(-6)}`);
    }
  }

  // Enhanced tool wrapper that tracks thinking time
  async wrapToolWithThinkingTime<T>(toolName: string, args: any, toolFunction: () => Promise<T>): Promise<T> {
    const now = performance.now();
    const session = this.sessionTimings.get(this.currentSessionId);
    
    if (session && session.callCount > 0) {
      // Calculate thinking time since last tool call
      const thinkingTime = now - session.lastCallTime;
      session.totalThinkingTime += thinkingTime;
      
      const time = new Date().toLocaleTimeString();
      if (thinkingTime > 500) { // Show thinking time if > 0.5 seconds
        const thinkingSeconds = (thinkingTime/1000).toFixed(1);
        console.log(`🧠 [${time}] LLM thinking: ${thinkingSeconds}s → calling ${toolName}`);
      }
    }

    // Use existing benchmark wrapper
    const result = await benchmark.startTool(toolName, args);
    
    try {
      const toolResult = await toolFunction();
      benchmark.endTool(result, toolResult);
      
      // Update session timing
      if (session) {
        session.lastCallTime = performance.now();
        session.callCount++;
      }
      
      return toolResult;
    } catch (error) {
      benchmark.endTool(result, null, error as Error);
      
      // Update session timing even on error
      if (session) {
        session.lastCallTime = performance.now();
        session.callCount++;
      }
      
      throw error;
    }
  }

  // Generate enhanced report with thinking time analysis
  generateEnhancedReport(): string {
    const toolReport = benchmark.generateReport(false);
    
    let sessionReport = '\n\n🧠 LLM Thinking Time Analysis:\n';
    sessionReport += '═══════════════════════════════════\n';
    
    for (const [sessionId, timing] of this.sessionTimings) {
      const totalSessionTime = (performance.now() - timing.sessionStartTime) / 1000;
      const avgThinkingTime = timing.totalThinkingTime / timing.callCount / 1000;
      const thinkingPercentage = (timing.totalThinkingTime / (performance.now() - timing.sessionStartTime)) * 100;
      
      sessionReport += `\n📊 Session ${sessionId.slice(-8)}:\n`;
      sessionReport += `• Total Session Time: ${totalSessionTime.toFixed(1)}s\n`;
      sessionReport += `• Tool Calls: ${timing.callCount}\n`;
      sessionReport += `• Total Thinking Time: ${(timing.totalThinkingTime/1000).toFixed(1)}s\n`;
      sessionReport += `• Avg Thinking per Call: ${avgThinkingTime.toFixed(1)}s\n`;
      sessionReport += `• Thinking vs Execution: ${thinkingPercentage.toFixed(1)}% thinking, ${(100-thinkingPercentage).toFixed(1)}% tools\n`;
      
      // Performance insights
      if (avgThinkingTime > 5) {
        sessionReport += `• ⚠️ Slow LLM: Average ${avgThinkingTime.toFixed(1)}s thinking time\n`;
      } else if (avgThinkingTime < 1) {
        sessionReport += `• 🚀 Fast LLM: Quick ${avgThinkingTime.toFixed(1)}s thinking time\n`;
      }
    }
    
    return toolReport + sessionReport;
  }

  // Get real-time session summary with thinking time breakdown
  getRealTimeSessionSummary(): string {
    if (!this.currentSessionId || !this.sessionTimings.has(this.currentSessionId)) {
      return '📊 No active session';
    }
    
    const session = this.sessionTimings.get(this.currentSessionId)!;
    const sessionDuration = (performance.now() - session.sessionStartTime) / 1000;
    const avgThinking = session.callCount > 0 ? (session.totalThinkingTime / session.callCount / 1000) : 0;
    const thinkingPercentage = session.callCount > 0 ? (session.totalThinkingTime / (performance.now() - session.sessionStartTime)) * 100 : 0;
    
    return `🧠 Session ${session.sessionId.slice(-6)} | ${session.callCount} calls | ${sessionDuration.toFixed(1)}s total | ${avgThinking.toFixed(1)}s avg thinking | ${thinkingPercentage.toFixed(0)}% thinking`;
  }

  // Compare LLM thinking patterns
  compareLLMThinkingSpeed(): string {
    if (this.sessionTimings.size < 2) {
      return '🔍 Need multiple sessions to compare LLM thinking speeds';
    }
    
    let comparison = '\n\n⚡ LLM Thinking Speed Comparison:\n';
    
    const sessionData = Array.from(this.sessionTimings.values())
      .filter(s => s.callCount > 0)
      .map(s => ({
        sessionId: s.sessionId,
        avgThinking: (s.totalThinkingTime / s.callCount / 1000),
        callCount: s.callCount
      }))
      .sort((a, b) => a.avgThinking - b.avgThinking);
    
    sessionData.forEach((data, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      
      comparison += `${medal} Session ${data.sessionId.slice(-8)}: ${data.avgThinking.toFixed(1)}s avg thinking (${data.callCount} calls)\n`;
    });
    
    return comparison;
  }
}

// Global enhanced benchmark instance
export const enhancedBenchmark = new EnhancedBenchmark();

// Enhanced wrapper that auto-detects sessions and tracks thinking time
export class EnhancedBenchmarkWrapper {
  private static currentSessionId: string | null = null;
  
  static async wrapTool<T>(toolName: string, args: any, toolFunction: () => Promise<T>): Promise<T> {
    // Reuse existing session or create new one
    if (!this.currentSessionId) {
      this.currentSessionId = `session_${Date.now().toString().slice(-6)}`;
    }
    
    enhancedBenchmark.startSession(this.currentSessionId);
    return await enhancedBenchmark.wrapToolWithThinkingTime(toolName, args, toolFunction);
  }
  
  static getEnhancedReport(): string {
    return enhancedBenchmark.generateEnhancedReport();
  }
  
  static getSessionSummary(): string {
    return enhancedBenchmark.getRealTimeSessionSummary();
  }
  
  static compareThinkingSpeeds(): string {
    return enhancedBenchmark.compareLLMThinkingSpeed();
  }
  
  // Delegate to original benchmark methods
  static setModel(model: string) {
    benchmark.setLLMModel(model);
  }
  
  static reset() {
    benchmark.resetSession();
    // Also reset our session tracking
    this.currentSessionId = null;
  }
}
