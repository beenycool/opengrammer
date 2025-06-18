import nlp from 'compromise';
import { ISuggestionService } from './types/suggestion';
import { logger } from './logger';

// Type definitions for NLP results
interface NLPToken {
  text: string;
  tags: string[];
}

interface NLEntity {
  text: string;
  type: string;
  offset: {
    start: number;
    end: number;
  };
}

/**
 * Enhanced NLP Processor with ML Suggestion Integration
 * Integrates with ISuggestionService for enhanced text and code suggestions
 */
export class NLPProcessor {
  private context: string = 'NLPProcessor';
  private suggestionService?: ISuggestionService;

  constructor(suggestionService?: ISuggestionService) {
    this.suggestionService = suggestionService;
    logger.info('NLP Processor initialized', this.context);
  }

  /**
   * Generate ML-enhanced suggestions from tokenized input
   * Based on responses_LS11.md integration requirements
   * @param input - Input text to process
   * @returns Array of suggestions
   */
  async generateSuggestions(input: string): Promise<string[]> {
    if (!this.suggestionService) {
      logger.warn('No suggestion service available for ML suggestions', this.context);
      return [];
    }

    try {
      const tokens = this.tokenize(input);
      logger.debug(`Generating suggestions for ${tokens.length} tokens`, this.context);
      
      return await this.suggestionService.suggestText(tokens);
    } catch (error) {
      logger.error('Suggestion service error', this.context, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Generate code suggestions using the suggestion service
   * @param codeContext - Code context for suggestions
   * @returns Array of code suggestions
   */
  async generateCodeSuggestions(codeContext: string): Promise<string[]> {
    if (!this.suggestionService) {
      logger.warn('No suggestion service available for code suggestions', this.context);
      return [];
    }

    try {
      logger.debug(`Generating code suggestions for context length: ${codeContext.length}`, this.context);
      
      return await this.suggestionService.suggestCode(codeContext);
    } catch (error) {
      logger.error('Code suggestion service error', this.context, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Tokenize text into array of strings
   * @param text - Text to tokenize
   * @returns Array of token strings
   */
  private tokenize(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Use compromise for basic tokenization, then convert to string array
    const doc = nlp(text);
    const terms = doc.terms().out('array') as string[];
    
    // Filter out empty tokens and normalize
    return terms
      .filter(term => term && term.trim().length > 0)
      .map(term => term.trim().toLowerCase());
  }

  /**
   * Set or update the suggestion service
   * @param suggestionService - New suggestion service instance
   */
  setSuggestionService(suggestionService: ISuggestionService): void {
    this.suggestionService = suggestionService;
    logger.info('Suggestion service updated', this.context);
  }
}

export function posTagger(sentence: string): Array<{ text: string; pos: string; start?: number; end?: number }> {
  if (!sentence || sentence.trim().length === 0) {
    return [];
  }

  const doc = nlp(sentence);
  const tokens: NLPToken[] = doc.json()[0]?.terms || [];
  let currentOffset = 0;
  
  return tokens.map(token => {
    const tokenText = token.text;
    const startOffset = sentence.indexOf(tokenText, currentOffset);
    const endOffset = startOffset + tokenText.length;
    currentOffset = endOffset;
    
    return {
      text: tokenText,
      pos: token.tags[0] || 'UNK',
      start: startOffset,
      end: endOffset
    };
  });
}

export function entityRecognizer(tokens: Array<{ text: string; pos: string; start?: number; end?: number }>): Array<{ text: string; type: string; start: number; end: number }> {
  if (tokens.length === 0) return [];
  
  const startTime = performance.now();
  
  try {
    const results = extractEntitiesOptimized(tokens);
    logNERPerformance(startTime);
    return results;
  } catch (error) {
    console.error('NER processing failed:', error);
    return [];
  }
}

/**
 * Extract entities with optimized processing to meet ≤4ms target
 */
function extractEntitiesOptimized(tokens: Array<{ text: string; pos: string; start?: number; end?: number }>): Array<{ text: string; type: string; start: number; end: number }> {
  const text = tokens.map(token => token.text).join(' ');
  const doc = nlp(text);
  
  const results: Array<{ text: string; type: string; start: number; end: number }> = [];
  
  // Process all entity types in a single optimized loop
  const entityExtractors = [
    { extractor: () => doc.people().json() || [], type: 'Person' },
    { extractor: () => doc.places().json() || [], type: 'Location' },
    { extractor: () => doc.organizations().json() || [], type: 'Organization' }
  ];
  
  for (const { extractor, type } of entityExtractors) {
    const entities = extractor();
    for (const entity of entities) {
      const entityResult = calculateEntityOffsets(entity.text, tokens, type);
      if (entityResult) {
        results.push(entityResult);
      }
    }
  }
  
  return results;
}

/**
 * Log NER performance metrics
 */
function logNERPerformance(startTime: number): void {
  const endTime = performance.now();
  const duration = endTime - startTime;
  console.log(`NER took ${duration.toFixed(2)}ms`);
}

/**
 * Calculate entity offsets using optimized token-based approach
 * Reduces complexity and improves performance for ≤4ms NER target
 */
function calculateEntityOffsets(
  entityText: string,
  tokens: Array<{ text: string; pos: string; start?: number; end?: number }>,
  entityType: string
): { text: string; type: string; start: number; end: number } | null {
  const entityTokens = findEntityTokensOptimized(entityText, tokens);
  
  if (entityTokens.length === 0) {
    return null;
  }
  
  return buildOptimizedEntityResult(entityText, entityType, entityTokens, tokens);
}

/**
 * Build entity result with optimized offset calculation
 */
function buildOptimizedEntityResult(
  entityText: string,
  entityType: string,
  entityTokens: Array<{ text: string; pos: string; start?: number; end?: number }>,
  allTokens: Array<{ text: string; pos: string; start?: number; end?: number }>
): { text: string; type: string; start: number; end: number } {
  const firstToken = entityTokens[0];
  const lastToken = entityTokens[entityTokens.length - 1];
  
  const start = getTokenOffset(firstToken, allTokens);
  const end = getTokenOffset(lastToken, allTokens) + lastToken.text.length;
  
  return {
    text: entityText,
    type: entityType,
    start,
    end
  };
}

/**
 * Find entity tokens with optimized algorithm for better performance
 */
function findEntityTokensOptimized(
  entityText: string,
  tokens: Array<{ text: string; pos: string; start?: number; end?: number }>
): Array<{ text: string; pos: string; start?: number; end?: number }> {
  const entityWords = entityText.toLowerCase().split(/\s+/);
  const entityLength = entityWords.length;
  
  // Optimized single-word entity matching (most common case)
  if (entityLength === 1) {
    const targetWord = entityWords[0];
    const matchingToken = tokens.find(t => t.text.toLowerCase() === targetWord);
    return matchingToken ? [matchingToken] : [];
  }
  
  // Multi-word entity matching with early termination
  for (let i = 0; i <= tokens.length - entityLength; i++) {
    if (matchesEntitySequence(tokens, i, entityWords)) {
      return tokens.slice(i, i + entityLength);
    }
  }
  
  return [];
}

/**
 * Check if token sequence matches entity words - optimized comparison
 */
function matchesEntitySequence(
  tokens: Array<{ text: string; pos: string; start?: number; end?: number }>,
  startIndex: number,
  entityWords: string[]
): boolean {
  for (let i = 0; i < entityWords.length; i++) {
    if (tokens[startIndex + i].text.toLowerCase() !== entityWords[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Get token offset with fallback - minimizes string operations
 */
function getTokenOffset(
  token: { text: string; start?: number },
  tokens: Array<{ text: string; start?: number }>
): number {
  return token.start !== undefined ? token.start : calculateFallbackOffset(token, tokens);
}

/**
 * Efficient fallback offset calculation - only when needed
 */
function calculateFallbackOffset(token: { text: string }, tokens: Array<{ text: string }>): number {
  const reconstructedText = tokens.map(t => t.text).join(' ');
  return reconstructedText.indexOf(token.text);
}

export function parseDependencies(sentence: string): Array<{ governor: string; dependent: string; relation: string }> {
  if (!sentence || sentence.trim().length === 0) {
    return [];
  }

  const startTime = performance.now();
  const doc = nlp(sentence);
  const results: Array<{ governor: string; dependent: string; relation: string }> = [];
  
  // For each sentence in the document
  doc.sentences().forEach((s: any) => {
    // Get dependency relations
    const deps = s.debug().relations || [];
    
    deps.forEach((dep: any) => {
      results.push({
        governor: dep.governor?.text || '',
        dependent: dep.dependent?.text || '',
        relation: dep.relation || ''
      });
    });
  });
  
  const endTime = performance.now();
  console.log(`Dependency parsing took ${(endTime - startTime).toFixed(2)}ms`);
  
  return results;
}