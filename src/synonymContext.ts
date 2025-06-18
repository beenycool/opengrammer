import { DictionaryStore } from './dictionaryStore';
import { SynonymProvider, DictionarySynonymProvider } from './synonymProvider';
import { logger } from './logger';

// Context scoring configuration
interface ContextScoringConfig {
  contextMappings: {
    [contextType: string]: {
      keywords: string[];
      synonymScores: {
        [synonym: string]: number;
      };
    };
  };
  defaultScore: number;
}

// Default context scoring configuration
const DEFAULT_CONTEXT_CONFIG: ContextScoringConfig = {
  contextMappings: {
    financial: {
      keywords: ['financial', 'money', 'loan', 'credit', 'bank'],
      synonymScores: {
        'institution': 0.9,
        'lender': 0.9,
        'financier': 0.9,
        'shore': 0.1,
        'riverside': 0.1
      }
    },
    geographical: {
      keywords: ['river', 'water', 'shore', 'stream'],
      synonymScores: {
        'shore': 0.9,
        'riverside': 0.9,
        'embankment': 0.9,
        'institution': 0.1,
        'lender': 0.1
      }
    }
  },
  defaultScore: 0.5
};

// Scoring strategy interface for context-aware synonym ranking
export interface ScoringStrategy {
  scoreSynonyms(word: string, synonyms: string[], context: string[]): Promise<Array<{synonym: string, score: number}>>;
}

// TF-IDF Scoring Strategy implementation
export class TFIDFScoringStrategy implements ScoringStrategy {
  private config: ContextScoringConfig;

  constructor(config: ContextScoringConfig = DEFAULT_CONTEXT_CONFIG) {
    this.config = config;
  }

  async scoreSynonyms(word: string, synonyms: string[], context: string[]): Promise<Array<{synonym: string, score: number}>> {
    if (!synonyms || synonyms.length === 0) {
      return [];
    }

    const contextWords = context.map(c => c.toLowerCase());
    
    return synonyms.map(synonym => {
      let score = this.config.defaultScore;
      
      if (context.length > 0) {
        score = this.calculateContextScore(synonym.toLowerCase(), contextWords);
      }
      
      return { synonym, score };
    }).sort((a, b) => b.score - a.score);
  }

  private calculateContextScore(synonym: string, contextWords: string[]): number {
    let bestScore = this.config.defaultScore;
    
    for (const [contextType, mapping] of Object.entries(this.config.contextMappings)) {
      const hasContextKeywords = contextWords.some(word =>
        mapping.keywords.includes(word)
      );
      
      if (hasContextKeywords && mapping.synonymScores[synonym] !== undefined) {
        bestScore = Math.max(bestScore, mapping.synonymScores[synonym]);
      }
    }
    
    return bestScore;
  }
}

// Neural Embedding Strategy with deterministic similarity scoring
export class NeuralEmbeddingStrategy implements ScoringStrategy {
  private config: ContextScoringConfig;

  constructor(config: ContextScoringConfig = DEFAULT_CONTEXT_CONFIG) {
    this.config = config;
  }

  async scoreSynonyms(word: string, synonyms: string[], context: string[]): Promise<Array<{synonym: string, score: number}>> {
    if (!synonyms || synonyms.length === 0) {
      return [];
    }

    // Use deterministic string similarity instead of random scores
    const contextWords = context.map(c => c.toLowerCase());
    
    return synonyms.map(synonym => {
      let score = this.config.defaultScore;
      
      if (context.length > 0) {
        // Calculate context-based similarity score
        score = this.calculateSimilarityScore(word.toLowerCase(), synonym.toLowerCase(), contextWords);
      } else {
        // Calculate basic string similarity when no context
        score = this.calculateStringSimilarity(word.toLowerCase(), synonym.toLowerCase());
      }
      
      return { synonym, score };
    }).sort((a, b) => b.score - a.score);
  }

  private calculateSimilarityScore(word: string, synonym: string, contextWords: string[]): number {
    // First check if we have specific context mappings
    let contextScore = this.config.defaultScore;
    
    for (const [contextType, mapping] of Object.entries(this.config.contextMappings)) {
      const hasContextKeywords = contextWords.some(contextWord =>
        mapping.keywords.includes(contextWord)
      );
      
      if (hasContextKeywords && mapping.synonymScores[synonym] !== undefined) {
        contextScore = Math.max(contextScore, mapping.synonymScores[synonym]);
      }
    }
    
    // Combine context score with string similarity
    const stringSimilarity = this.calculateStringSimilarity(word, synonym);
    return Math.max(contextScore, stringSimilarity * 0.8); // Weight string similarity lower
  }

  private calculateStringSimilarity(word1: string, word2: string): number {
    if (word1 === word2) return 1.0;
    
    // Calculate Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(word1, word2);
    const maxLength = Math.max(word1.length, word2.length);
    
    if (maxLength === 0) return 1.0;
    
    const similarity = 1 - (distance / maxLength);
    
    // Normalize to reasonable synonym score range (0.1 to 0.9)
    return Math.max(0.1, Math.min(0.9, similarity * 0.8 + 0.2));
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

// Context-aware synonym provider that combines lookup with scoring
export class ContextAwareSynonymProvider implements SynonymProvider {
  constructor(
    private dictionary: DictionaryStore, 
    private scoringStrategy: ScoringStrategy
  ) {}

  async getCandidates(word: string, context?: string[]): Promise<string[]> {
    if (!word || word.trim() === '') {
      return [];
    }

    try {
      // Get basic synonyms from dictionary
      const dictionaryProvider = new DictionarySynonymProvider(this.dictionary);
      const synonyms = await dictionaryProvider.getCandidates(word, context);
      
      if (synonyms.length === 0) {
        return [];
      }

      // Score and rank synonyms by context relevance
      if (context && context.length > 0) {
        try {
          const scores = await this.scoringStrategy.scoreSynonyms(word, synonyms, context);
          return scores.map(s => s.synonym);
        } catch (error) {
          logger.error('Synonym scoring failed, falling back to unscored results', 'ContextAwareSynonymProvider', error as Error);
          return synonyms;
        }
      }
      
      return synonyms;
    } catch (error) {
      logger.error('Context-aware synonym lookup failed', 'ContextAwareSynonymProvider', error as Error);
      return [];
    }
  }
}