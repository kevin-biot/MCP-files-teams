// Knowledge Seeding System - Core system for knowledge pattern management
// Defines templates and interfaces for knowledge seeding operations

import { KnowledgeSourceClass } from '../../memory-extension.js';

export interface KnowledgeSeedTemplate {
  pattern: string;
  description: string;
  sourceClass: KnowledgeSourceClass;
  contextHints: string[];
  tags: string[];
  priority?: number;
  metadata?: Record<string, any>;
}

export interface KnowledgeSeedResult {
  success: boolean;
  templateId: string;
  timestamp: string;
  pattern: string;
  sourceClass: KnowledgeSourceClass;
  message: string;
  errors?: string[];
}

export interface KnowledgePattern {
  id: string;
  template: KnowledgeSeedTemplate;
  created: string;
  lastUsed?: string;
  usageCount: number;
  effectiveness: number;
}

export class KnowledgeSeedingSystem {
  private patterns = new Map<string, KnowledgePattern>();
  
  constructor() {
    // Initialize with some default patterns
    this.initializeDefaultPatterns();
  }

  private initializeDefaultPatterns(): void {
    const defaultPatterns: KnowledgeSeedTemplate[] = [
      {
        pattern: 'diagnostic-troubleshooting',
        description: 'Systematic approach to diagnosing technical issues',
        sourceClass: KnowledgeSourceClass.ENGINEER_ADDED,
        contextHints: ['error', 'troubleshoot', 'debug', 'diagnose'],
        tags: ['diagnostics', 'troubleshooting', 'technical-support'],
        priority: 1
      },
      {
        pattern: 'deployment-automation',
        description: 'Automated deployment workflow patterns',
        sourceClass: KnowledgeSourceClass.SYSTEM_GENERATED,
        contextHints: ['deploy', 'automation', 'ci/cd', 'pipeline'],
        tags: ['deployment', 'automation', 'devops'],
        priority: 2
      }
    ];

    defaultPatterns.forEach(template => {
      this.createPattern(template);
    });
  }

  createPattern(template: KnowledgeSeedTemplate): KnowledgePattern {
    const id = `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pattern: KnowledgePattern = {
      id,
      template,
      created: new Date().toISOString(),
      usageCount: 0,
      effectiveness: 0.5
    };
    
    this.patterns.set(id, pattern);
    return pattern;
  }

  getPattern(id: string): KnowledgePattern | undefined {
    return this.patterns.get(id);
  }

  listPatterns(): KnowledgePattern[] {
    return Array.from(this.patterns.values());
  }

  findPatternsByContext(contextHints: string[]): KnowledgePattern[] {
    return this.listPatterns().filter(pattern => {
      return contextHints.some(hint => 
        pattern.template.contextHints.some(templateHint => 
          templateHint.toLowerCase().includes(hint.toLowerCase())
        )
      );
    });
  }

  executePattern(id: string): KnowledgeSeedResult {
    const pattern = this.getPattern(id);
    if (!pattern) {
      return {
        success: false,
        templateId: id,
        timestamp: new Date().toISOString(),
        pattern: 'unknown',
        sourceClass: KnowledgeSourceClass.SYSTEM_GENERATED,
        message: 'Pattern not found',
        errors: [`Pattern with id ${id} does not exist`]
      };
    }

    // Update usage statistics
    pattern.usageCount++;
    pattern.lastUsed = new Date().toISOString();
    
    return {
      success: true,
      templateId: id,
      timestamp: new Date().toISOString(),
      pattern: pattern.template.pattern,
      sourceClass: pattern.template.sourceClass,
      message: `Pattern ${pattern.template.pattern} executed successfully`
    };
  }

  updatePatternEffectiveness(id: string, effectiveness: number): boolean {
    const pattern = this.getPattern(id);
    if (!pattern) return false;
    
    pattern.effectiveness = Math.max(0, Math.min(1, effectiveness));
    return true;
  }
}

// Export singleton instance
export const knowledgeSeedingSystem = new KnowledgeSeedingSystem();
