import { DictionaryStore } from './dictionaryStore';
import { logger } from './logger';

// SynonymProvider interface for pluggable synonym lookup
export interface SynonymProvider {
  getCandidates(word: string): Promise<string[]>;
  getCandidates(word: string, context: string[]): Promise<string[]>;
}

// DictionarySynonymProvider implementation
export class DictionarySynonymProvider implements SynonymProvider {
  constructor(private dictionary: DictionaryStore) {}

  async getCandidates(word: string, context?: string[]): Promise<string[]> {
    if (!word || word.trim() === '') {
      return [];
    }

    try {
      const words = await this.dictionary.listWords();
      const synonymEntries = words.filter(entry => entry.startsWith('synonym:'));
      
      for (const entry of synonymEntries) {
        const parts = entry.split(':');
        if (parts.length >= 3) {
          const [, entryWord, synonymsStr] = parts;
          
          if (entryWord.toLowerCase() === word.toLowerCase()) {
            if (synonymsStr) {
              return synonymsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
            }
            return [];
          }
        }
      }
      
      return [];
    } catch (error) {
      logger.error('Dictionary synonym lookup failed', 'SynonymProvider', error as Error);
      return [];
    }
  }
}