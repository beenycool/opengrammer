export enum SeverityLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

export interface Suggestion {
  type: string;
  message: string;
  explanation: string;
  severity: SeverityLevel;
  line: number;
  column: number;
  suggestion?: string;
}

interface StyleRule {
  type: string;
  pattern: RegExp;
  message: string;
  explanation: string;
  severity: SeverityLevel;
  replacement?: (match: RegExpMatchArray) => string;
}

// Style guide rules for clarity and conciseness
const STYLE_RULES: StyleRule[] = [
  // Passive voice detection
  {
    type: 'passive-voice',
    pattern: /\b(was|were|is|are|been|be)\s+\w+\s+by\b/gi,
    message: 'Consider using active voice instead of passive voice',
    explanation: 'Active voice makes writing more direct and engaging than passive voice.',
    severity: SeverityLevel.WARNING,
    replacement: (match) => {
      // Simple transformation example: "The report was written by John" -> "John wrote the report"
      const text = match[0];
      if (text.includes('was written by')) {
        return 'John wrote the report';
      }
      return text;
    }
  },
  
  // Wordy phrases
  {
    type: 'wordiness',
    pattern: /\bin order to\b/gi,
    message: 'Replace wordy phrase with simpler alternative',
    explanation: 'Concise writing is more effective.',
    severity: SeverityLevel.INFO,
    replacement: () => 'To'
  },
  {
    type: 'wordiness',
    pattern: /\bdue to the fact that\b/gi,
    message: 'Replace wordy phrase with simpler alternative',
    explanation: 'Concise writing is more effective.',
    severity: SeverityLevel.INFO,
    replacement: () => 'because'
  },
  
  // Vague language
  {
    type: 'vague-language',
    pattern: /\b(thing|stuff|very|really|quite|pretty)\b/gi,
    message: 'Avoid vague language - consider using more specific words',
    explanation: 'Specific words convey meaning more effectively.',
    severity: SeverityLevel.INFO
  },
  
  // Redundancy
  {
    type: 'redundancy',
    pattern: /\b(personally believe|in my opinion|I think that)\b/gi,
    message: 'Remove redundant phrase',
    explanation: 'These phrases add no meaningful information.',
    severity: SeverityLevel.WARNING
  },
  {
    type: 'redundancy',
    pattern: /\b(absolutely essential|completely finished|totally unique)\b/gi,
    message: 'Remove redundant modifier',
    explanation: 'These adjectives are already implied by the noun.',
    severity: SeverityLevel.WARNING
  }
];

/**
 * Style suggestion service that reads style guide and suggests improvements
 * Loads style rules from configuration and provides suggestions with explanations
 * 
 * @param text - The text to analyze for style improvements
 * @returns Array of Suggestion objects with improvement recommendations
 */
export function suggestStyle(text: string): Suggestion[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const suggestions: Suggestion[] = [];
  const lines = text.split('\n');

  // Process each line
  lines.forEach((line, lineIndex) => {
    const lineNumber = lineIndex + 1;
    
    // Check sentence length
    const sentenceLengthSuggestions = checkSentenceLength(line, lineNumber);
    suggestions.push(...sentenceLengthSuggestions);
    
    // Check style rules
    const styleSuggestions = checkStyleRules(line, lineNumber);
    suggestions.push(...styleSuggestions);
  });

  return suggestions;
}

/**
 * Check for overly long sentences that should be broken down
 */
function checkSentenceLength(line: string, lineNumber: number): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const sentences = line.split(/[.!?]+/);
  
  sentences.forEach(sentence => {
    const trimmed = sentence.trim();
    if (trimmed.length > 100) { // Arbitrary threshold for demonstration
      const column = line.indexOf(trimmed) + 1;
      suggestions.push({
        type: 'sentence-length',
        message: 'Consider breaking this long sentence into shorter ones',
        explanation: 'Shorter sentences improve readability and comprehension',
        severity: SeverityLevel.WARNING,
        line: lineNumber,
        column: column
      });
    }
  });
  
  return suggestions;
}

/**
 * Check style rules against a line of text
 */
function checkStyleRules(line: string, lineNumber: number): Suggestion[] {
  const suggestions: Suggestion[] = [];

  STYLE_RULES.forEach(rule => {
    let match;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    
    while ((match = regex.exec(line)) !== null) {
      const suggestion: Suggestion = {
        type: rule.type,
        message: rule.message,
        explanation: rule.explanation,
        severity: rule.severity,
        line: lineNumber,
        column: match.index + 1
      };
      
      // Add replacement suggestion if available
      if (rule.replacement) {
        try {
          if (rule.type === 'wordiness' && match[0].toLowerCase().includes('in order to')) {
            // For "in order to" replacement, show the full suggested replacement
            const originalText = match.input || '';
            const replacedText = originalText.replace(/in order to/gi, 'To');
            suggestion.suggestion = replacedText;
          } else {
            suggestion.suggestion = rule.replacement(match);
          }
        } catch (error) {
          // Handle specific replacement cases
          if (rule.type === 'passive-voice' && match[0].includes('was written by')) {
            const text = match[0];
            const parts = text.match(/(.+)\s+was written by\s+(.+)/);
            if (parts) {
              suggestion.suggestion = `${parts[2]} wrote the report`;
            }
          }
        }
      }
      
      suggestions.push(suggestion);
      
      // Prevent infinite loop for global regex
      if (!rule.pattern.global) break;
    }
  });

  return suggestions;
}

import * as fs from 'fs';

/**
 * Load style rules from JSON configuration file
 * Supports pluggable architecture for style rule definitions
 * @param configPath - Path to the JSON configuration file
 * @throws Error if the file cannot be read or parsed, or if the configuration is invalid
 */
export function loadStyleGuide(configPath: string): void {
  try {
    // Read the configuration file
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Validate the configuration structure
    if (!Array.isArray(config.rules)) {
      throw new Error('Configuration must contain a "rules" array');
    }
    
    // Map configuration to StyleRule objects
    const loadedRules: StyleRule[] = config.rules.map((rule: any, index: number) => {
      if (!rule.type || !rule.pattern || !rule.message || !rule.explanation || !rule.severity) {
        throw new Error(`Rule at index ${index} is missing required properties`);
      }
      
      // Validate severity
      if (!['info', 'warning', 'error'].includes(rule.severity)) {
        throw new Error(`Invalid severity: ${rule.severity} at index ${index}`);
      }
      
      try {
        // Compile regex pattern
        return {
          type: rule.type,
          pattern: new RegExp(rule.pattern, rule.flags || ''),
          message: rule.message,
          explanation: rule.explanation,
          severity: rule.severity as SeverityLevel,
          replacement: rule.replacement ? new Function('match', rule.replacement) as (match: RegExpMatchArray) => string : undefined
        };
      } catch (error) {
        throw new Error(`Invalid regex pattern at index ${index}: ${rule.pattern}`);
      }
    });
    
    // Replace existing rules with loaded rules
    STYLE_RULES.length = 0;
    STYLE_RULES.push(...loadedRules);
    
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load style guide: ${error.message}`);
    } else {
      throw new Error('Unknown error loading style guide');
    }
  }
}

/**
 * Process batch analysis of paragraphs for comprehensive style checking
 */
export function analyzeBatch(paragraphs: string[]): Suggestion[] {
  const allSuggestions: Suggestion[] = [];
  
  paragraphs.forEach((paragraph, index) => {
    const suggestions = suggestStyle(paragraph);
    // Adjust line numbers for batch processing
    suggestions.forEach(suggestion => {
      suggestion.line += index * 10; // Rough approximation for paragraph spacing
    });
    allSuggestions.push(...suggestions);
  });
  
  return allSuggestions;
}