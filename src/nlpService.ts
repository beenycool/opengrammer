import nlp from 'compromise';
import { DictionaryStore } from './dictionaryStore';
import { SynonymProvider, DictionarySynonymProvider } from './synonymProvider';
import { ScoringStrategy, TFIDFScoringStrategy, NeuralEmbeddingStrategy, ContextAwareSynonymProvider } from './synonymContext';
import { logger } from './logger';

// Global dictionary store instance
let dictionaryStore: DictionaryStore | null = null;

export function setDictionaryStore(store: DictionaryStore) {
  dictionaryStore = store;
}

export function getDictionaryStore(): DictionaryStore | null {
  return dictionaryStore;
}

// Global synonym provider instance
let globalSynonymProvider: SynonymProvider | null = null;

export function setSynonymProvider(provider: SynonymProvider | null): void {
  globalSynonymProvider = provider;
}

// Enhanced token interface with synonyms
export interface EnhancedToken {
  text: string;
  pos: string;
  synonyms: string[];
  start?: number;
  end?: number;
}

export function posTagger(sentence: string): Array<{ text: string; pos: string }> {
  if (!sentence || sentence.trim().length === 0) {
    return [];
  }

  try {
    const doc = nlp(sentence);
    const terms = doc.json()[0]?.terms || [];
    
    return terms.map((term: any) => ({
      text: term.text,
      pos: term.tags[0] || 'UNK'
    }));
  } catch (error) {
    logger.error('POS tagging failed', 'NLPService', error as Error);
    return sentence.split(/\s+/).map(text => ({ text, pos: 'UNK' }));
  }
}

// Helper function to find entity position using token data instead of string search
function findEntityPosition(entityText: string, tokens: Array<{ text: string; pos: string }>): { start: number; end: number } | null {
  const entityWords = entityText.toLowerCase().split(/\s+/);
  
  if (entityWords.length === 1) {
    // Single word entity - find exact match
    const tokenIndex = tokens.findIndex(token => token.text.toLowerCase() === entityWords[0]);
    if (tokenIndex === -1) return null;
    
    // Calculate position based on token index
    let position = 0;
    for (let i = 0; i < tokenIndex; i++) {
      position += tokens[i].text.length + 1; // +1 for space
    }
    
    return {
      start: position,
      end: position + tokens[tokenIndex].text.length
    };
  } else {
    // Multi-word entity - find sequence match
    for (let i = 0; i <= tokens.length - entityWords.length; i++) {
      const isMatch = entityWords.every((word, index) => 
        tokens[i + index].text.toLowerCase() === word
      );
      
      if (isMatch) {
        // Calculate start position
        let startPosition = 0;
        for (let j = 0; j < i; j++) {
          startPosition += tokens[j].text.length + 1; // +1 for space
        }
        
        // Calculate end position
        let endPosition = startPosition;
        for (let j = 0; j < entityWords.length; j++) {
          endPosition += tokens[i + j].text.length;
          if (j < entityWords.length - 1) endPosition += 1; // space between words
        }
        
        return { start: startPosition, end: endPosition };
      }
    }
    
    return null;
  }
}
export async function entityRecognizer(tokens: Array<{ text: string; pos: string }>): Promise<Array<{ text: string; type: string; start: number; end: number }>> {
  if (tokens.length === 0) return [];
  
  try {
    // Reconstruct text for NLP processing
    const text = tokens.map(t => t.text).join(' ');
    const doc = nlp(text);
    
    // Get entities from compromise
    const people = doc.people().json() || [];
    const places = doc.places().json() || [];
    const organizations = doc.organizations().json() || [];
    
    const results: Array<{ text: string; type: string; start: number; end: number }> = [];
    
    // Process people entities
    people.forEach((entity: any) => {
      const position = findEntityPosition(entity.text, tokens);
      if (position) {
        results.push({
          text: entity.text,
          type: 'Person',
          start: position.start,
          end: position.end
        });
      }
    });
    
    // Process places entities
    places.forEach((entity: any) => {
      const position = findEntityPosition(entity.text, tokens);
      if (position) {
        results.push({
          text: entity.text,
          type: 'Location',
          start: position.start,
          end: position.end
        });
      }
    });
    
    // Process organizations entities
    organizations.forEach((entity: any) => {
      const position = findEntityPosition(entity.text, tokens);
      if (position) {
        results.push({
          text: entity.text,
          type: 'Organization',
          start: position.start,
          end: position.end
        });
      }
    });
    
    // Add custom entities from dictionary store
    if (dictionaryStore) {
      const words = await dictionaryStore.listWords();
      const customEntities = words
        .filter((word: string) => word.startsWith('entity:'))
        .map((word: string) => {
          const parts = word.split(':');
          if (parts.length >= 3) {
            const [_, type, value] = parts;
            // Check if this entity appears in the text
            const entityText = tokens.find(t => t.text.toLowerCase() === value.toLowerCase());
            if (entityText) {
              return {
                text: value,
                type: type,
                start: -1,
                end: -1
              };
            }
          }
          return null;
        })
        .filter((entity: any) => entity !== null) as Array<{ text: string; type: string; start: number; end: number }>;
      
      results.push(...customEntities);
    }
    
    return results;
  } catch (error) {
    logger.error('Entity recognition failed', 'NLPService', error as Error);
    return [];
  }
}

// Re-export types and classes for external use
export type { SynonymProvider } from './synonymProvider';
export type { ScoringStrategy } from './synonymContext';
export { DictionarySynonymProvider } from './synonymProvider';
export { TFIDFScoringStrategy, NeuralEmbeddingStrategy, ContextAwareSynonymProvider } from './synonymContext';

// Enhanced processText function with synonym enrichment
export async function processText(text: string): Promise<EnhancedToken[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  try {
    // Get POS tags using existing function
    const tokens = posTagger(text);
    
    // Extract context words for context-aware synonym lookup
    const contextWords = tokens
      .filter(token => token.pos && !['Punctuation', 'Determiner'].includes(token.pos))
      .map(token => token.text.toLowerCase());
    
    // Calculate positions for tokens
    let currentPosition = 0;
    const tokensWithPositions = tokens.map(token => {
      const tokenIndex = text.indexOf(token.text, currentPosition);
      const start = tokenIndex !== -1 ? tokenIndex : currentPosition;
      const end = start + token.text.length;
      currentPosition = end + 1; // +1 for space
      
      return {
        ...token,
        start,
        end
      };
    });

    // Enrich tokens with synonyms
    const enhancedTokens: EnhancedToken[] = await Promise.all(
      tokensWithPositions.map(async (token) => {
        const enhancedToken: EnhancedToken = {
          ...token,
          synonyms: []
        };
        
        // Skip punctuation and determiners for synonym lookup
        if (token.pos === 'Punctuation' || token.pos === 'Determiner') {
          return enhancedToken;
        }
        
        // Get synonyms if provider is available
        if (globalSynonymProvider) {
          try {
            const synonyms = await globalSynonymProvider.getCandidates(token.text, contextWords);
            enhancedToken.synonyms = synonyms;
          } catch (error) {
            logger.error(`Synonym lookup failed for word "${token.text}"`, 'NLPService', error as Error);
            enhancedToken.synonyms = [];
          }
        }
        
        return enhancedToken;
      })
    );
    
    return enhancedTokens;
  } catch (error) {
    logger.error('Enhanced text processing failed', 'NLPService', error as Error);
    // Fallback to basic tokens with empty synonyms
    const tokens = posTagger(text);
    return tokens.map(token => ({
      ...token,
      synonyms: []
    }));
  }
}

export function parseDependencies(sentence: string): Array<{ governor: string; dependent: string; relation: string }> {
  if (!sentence || sentence.trim().length === 0) {
    return [];
  }

  try {
    const startTime = performance.now();
    const doc = nlp(sentence);
    const results: Array<{ governor: string; dependent: string; relation: string }> = [];
    
    // Since compromise.js doesn't have full dependency parsing,
    // we'll create basic dependency relations based on sentence structure
    const sentences = doc.sentences().json();
    
    sentences.forEach((sent: any) => {
      const terms = sent.terms || [];
      
      // Create basic dependency relations
      terms.forEach((term: any, index: number) => {
        // Subject-verb relations
        if (term.tags.includes('Noun') && index < terms.length - 1) {
          const nextTerm = terms[index + 1];
          if (nextTerm.tags.includes('Verb')) {
            results.push({
              governor: nextTerm.text,
              dependent: term.text,
              relation: 'nsubj'
            });
          }
        }
        
        // Verb-object relations
        if (term.tags.includes('Verb') && index < terms.length - 1) {
          const nextTerm = terms[index + 1];
          if (nextTerm.tags.includes('Noun')) {
            results.push({
              governor: term.text,
              dependent: nextTerm.text,
              relation: 'dobj'
            });
          }
        }
        
        // Preposition relations
        if (term.tags.includes('Preposition') && index > 0) {
          const prevTerm = terms[index - 1];
          if (prevTerm.tags.includes('Verb')) {
            results.push({
              governor: prevTerm.text,
              dependent: term.text,
              relation: 'prep'
            });
          }
        }
        
        // Punctuation relations
        if (term.tags.includes('Punctuation') && index > 0) {
          const prevTerm = terms[index - 1];
          results.push({
            governor: prevTerm.text,
            dependent: term.text,
            relation: 'punct'
          });
        }
      });
    });
    
    const endTime = performance.now();
    console.log(`Dependency parsing took ${(endTime - startTime).toFixed(2)}ms`);
    return results;
  } catch (error) {
    logger.error('Dependency parsing failed', 'NLPService', error as Error);
    return [];
  }
}