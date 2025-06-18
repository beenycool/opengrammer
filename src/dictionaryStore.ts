import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class DictionaryStore {
  private words: Set<string> = new Set();
  private isInitialized = false;

  constructor(
    private filePath: string,
    private passphrase: string
  ) {}

  /**
   * Initialize the dictionary store by loading from encrypted file
   * Performs automatic unlocking with the provided passphrase
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (fs.existsSync(this.filePath)) {
        await this.loadFromFile();
      } else {
        // Create empty dictionary if file doesn't exist
        this.words = new Set();
        await this.saveToFile();
      }
      this.isInitialized = true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('bad decrypt')) {
        throw new Error('Failed to decrypt dictionary: invalid passphrase');
      } else if (error instanceof Error && error.message.includes('Invalid')) {
        throw new Error('Dictionary file appears to be corrupted');
      }
      throw error;
    }
  }

  /**
   * Add a word to the custom dictionary
   * @param word - The word to add
   */
  async addWord(word: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Dictionary store not initialized');
    }

    const normalizedWord = word.toLowerCase().trim();
    if (normalizedWord && !this.words.has(normalizedWord)) {
      this.words.add(normalizedWord);
      await this.saveToFile();
    }
  }

  /**
   * Remove a word from the custom dictionary
   * @param word - The word to remove
   */
  async removeWord(word: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Dictionary store not initialized');
    }

    const normalizedWord = word.toLowerCase().trim();
    if (this.words.has(normalizedWord)) {
      this.words.delete(normalizedWord);
      await this.saveToFile();
    }
  }

  /**
   * List all words in the custom dictionary
   * @returns Array of words sorted alphabetically
   */
  async listWords(): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('Dictionary store not initialized');
    }

    return Array.from(this.words).sort();
  }

  /**
   * Check if a word exists in the dictionary
   * @param word - The word to check
   * @returns True if word exists
   */
  async hasWord(word: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Dictionary store not initialized');
    }

    return this.words.has(word.toLowerCase().trim());
  }

  /**
   * Get the number of words in the dictionary
   * @returns Word count
   */
  async getWordCount(): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('Dictionary store not initialized');
    }

    return this.words.size;
  }

  /**
   * Load dictionary from encrypted file using AES-256
   */
  private async loadFromFile(): Promise<void> {
    try {
      const encryptedData = fs.readFileSync(this.filePath);
      const decryptedData = this.decrypt(encryptedData);
      
      if (decryptedData.trim()) {
        const wordsArray = JSON.parse(decryptedData);
        this.words = new Set(wordsArray);
      } else {
        this.words = new Set();
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Dictionary file appears to be corrupted');
      }
      throw error;
    }
  }

  /**
   * Save dictionary to encrypted file using AES-256
   */
  private async saveToFile(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const wordsArray = Array.from(this.words);
      const jsonData = JSON.stringify(wordsArray);
      const encryptedData = this.encrypt(jsonData);
      
      fs.writeFileSync(this.filePath, encryptedData);
    } catch (error) {
      if (error instanceof Error) {
        if ('code' in error) {
          switch (error.code) {
            case 'ENOSPC':
              throw new Error('Failed to save dictionary: disk space is full');
            case 'EACCES':
              throw new Error('Failed to save dictionary: permission denied');
            default:
              throw new Error(`Failed to save dictionary: ${error.message}`);
          }
        } else {
          throw new Error(`Failed to save dictionary: ${error.message}`);
        }
      } else {
        throw new Error('Unknown error saving dictionary');
      }
    }
  }

  /**
   * Encrypt data using AES-256-GCM with randomized salt and IV
   * @param text - Plain text to encrypt
   * @returns Encrypted buffer containing salt, IV, auth tag, and ciphertext
   */
  private encrypt(text: string): Buffer {
    try {
      const algorithm = 'aes-256-gcm';
      // Generate random salt and IV
      const salt = crypto.randomBytes(16);
      const iv = crypto.randomBytes(12);
      
      // Derive key using randomized salt
      const key = crypto.scryptSync(this.passphrase, salt, 32);
      
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      // Encrypt the data
      const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
      ]);
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine salt, IV, auth tag, and encrypted data
      return Buffer.concat([salt, iv, authTag, encrypted]);
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Decrypt data using AES-256-GCM with authentication tag verification
   * @param encryptedData - Encrypted buffer containing salt, IV, auth tag, and ciphertext
   * @returns Decrypted plain text
   * @throws Error if decryption fails or authentication tag doesn't match
   */
  private decrypt(encryptedData: Buffer): string {
    try {
      const algorithm = 'aes-256-gcm';
      
      // Extract components from encrypted data
      const salt = encryptedData.subarray(0, 16);
      const iv = encryptedData.subarray(16, 28);
      const authTag = encryptedData.subarray(28, 44);
      const ciphertext = encryptedData.subarray(44);
      
      // Derive key using stored salt
      const key = crypto.scryptSync(this.passphrase, salt, 32);
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt the data
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unsupported state or unable to authenticate data')) {
        throw new Error('Failed to decrypt dictionary: authentication tag verification failed');
      }
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear all words from the dictionary
   */
  async clear(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Dictionary store not initialized');
    }

    this.words.clear();
    await this.saveToFile();
  }

  /**
   * Import words from an array
   * @param words - Array of words to import
   */
  async importWords(words: string[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Dictionary store not initialized');
    }

    const originalSize = this.words.size;
    
    words.forEach(word => {
      const normalizedWord = word.toLowerCase().trim();
      if (normalizedWord) {
        this.words.add(normalizedWord);
      }
    });

    // Only save if words were actually added
    if (this.words.size > originalSize) {
      await this.saveToFile();
    }
  }

  /**
   * Export all words as an array
   * @returns Array of all words
   */
  async exportWords(): Promise<string[]> {
    return this.listWords();
  }
}