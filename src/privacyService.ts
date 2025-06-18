import { IPrivacyService, PIIEntity } from './types/suggestion';
import { logger } from './logger';
import * as crypto from 'crypto';

/**
 * Privacy Service Implementation
 * Handles PII detection, anonymization, and data encryption
 * Based on responses_LS11.md requirements
 */
export class PrivacyService implements IPrivacyService {
  private context: string = 'PrivacyService';
  private encryptionKey: string;
  private algorithm: string = 'aes-256-gcm';
  
  // PII detection patterns based on reflection feedback
  private readonly piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    // Simple name detection pattern (can be enhanced with NER)
    name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g
  };

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey || this.generateEncryptionKey();
    logger.info('Privacy service initialized', this.context);
  }

  /**
   * Detect and anonymize PII in text
   * @param text - Input text to process
   * @returns Anonymized text with PII replaced
   */
  async anonymizeText(text: string): Promise<string> {
    if (!text || text.trim().length === 0) {
      return text;
    }

    try {
      logger.debug(`Anonymizing text - length: ${text.length}`, this.context);
      
      const entities = await this.detectPII(text);
      let anonymizedText = text;

      // Sort entities by start position in reverse order to maintain positions
      entities.sort((a, b) => b.start - a.start);

      for (const entity of entities) {
        const pseudonym = this.generatePseudonym(entity.type, entity.text);
        anonymizedText = anonymizedText.substring(0, entity.start) + 
                        pseudonym + 
                        anonymizedText.substring(entity.end);
      }

      logger.info(`Text anonymized - entities found: ${entities.length}`, this.context);
      return anonymizedText;
    } catch (error) {
      logger.error('Failed to anonymize text', this.context, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Detect PII entities in text
   * @param text - Input text to analyze
   * @returns Array of detected PII entities
   */
  async detectPII(text: string): Promise<PIIEntity[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const entities: PIIEntity[] = [];

    try {
      // Email detection
      const emailMatches = Array.from(text.matchAll(this.piiPatterns.email));
      for (const match of emailMatches) {
        if (match.index !== undefined) {
          entities.push({
            type: 'email',
            text: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: 0.95
          });
        }
      }

      // Phone number detection
      const phoneMatches = Array.from(text.matchAll(this.piiPatterns.phone));
      for (const match of phoneMatches) {
        if (match.index !== undefined) {
          entities.push({
            type: 'phone',
            text: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: 0.90
          });
        }
      }

      // SSN detection
      const ssnMatches = Array.from(text.matchAll(this.piiPatterns.ssn));
      for (const match of ssnMatches) {
        if (match.index !== undefined) {
          entities.push({
            type: 'ssn',
            text: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: 0.98
          });
        }
      }

      // Name detection (basic pattern-based)
      const nameMatches = Array.from(text.matchAll(this.piiPatterns.name));
      for (const match of nameMatches) {
        if (match.index !== undefined) {
          // Lower confidence for pattern-based name detection
          entities.push({
            type: 'name',
            text: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: 0.70
          });
        }
      }

      logger.debug(`PII detection completed - entities found: ${entities.length}`, this.context);
      return entities;
    } catch (error) {
      logger.error('Failed to detect PII', this.context, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Encrypt data for storage using AES-256-GCM
   * @param data - Data to encrypt
   * @returns Encrypted data string
   */
  async encryptData(data: string): Promise<string> {
    if (!data) {
      return data;
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Include IV in the encrypted data for decryption
      const result = iv.toString('hex') + ':' + encrypted;
      
      logger.debug(`Data encrypted - original length: ${data.length}`, this.context);
      return result;
    } catch (error) {
      logger.error('Failed to encrypt data', this.context, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Decrypt stored data
   * @param encryptedData - Encrypted data to decrypt
   * @returns Original data string
   */
  async decryptData(encryptedData: string): Promise<string> {
    if (!encryptedData) {
      return encryptedData;
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      logger.debug(`Data decrypted - result length: ${decrypted.length}`, this.context);
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt data', this.context, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Generate a consistent pseudonym for PII replacement
   * @param type - Type of PII
   * @param original - Original PII text
   * @returns Pseudonym string
   */
  private generatePseudonym(type: PIIEntity['type'], original: string): string {
    // Create a hash-based pseudonym that's consistent for the same input
    const hash = crypto.createHash('sha256').update(original + this.encryptionKey).digest('hex').substring(0, 8);
    
    switch (type) {
      case 'email':
        return `user${hash}@example.com`;
      case 'phone':
        return `555-${hash.substring(0, 3)}-${hash.substring(3, 7)}`;
      case 'name':
        return `Person${hash.substring(0, 4)}`;
      case 'ssn':
        return `XXX-XX-${hash.substring(0, 4)}`;
      case 'address':
        return `[ADDRESS_${hash.substring(0, 6)}]`;
      default:
        return `[${type.toUpperCase()}_${hash.substring(0, 6)}]`;
    }
  }

  /**
   * Generate a secure encryption key
   * @returns Base64 encoded encryption key
   */
  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Update encryption key (for key rotation)
   * @param newKey - New encryption key
   */
  updateEncryptionKey(newKey: string): void {
    this.encryptionKey = newKey;
    logger.info('Encryption key updated', this.context);
  }

  /**
   * Get privacy service statistics
   * @returns Privacy metrics
   */
  getPrivacyMetrics(): {
    supportedPiiTypes: string[];
    encryptionAlgorithm: string;
    keyLength: number;
  } {
    return {
      supportedPiiTypes: Object.keys(this.piiPatterns),
      encryptionAlgorithm: this.algorithm,
      keyLength: this.encryptionKey.length
    };
  }

  /**
   * Validate PII detection accuracy with test cases
   * @param testCases - Array of test cases with expected results
   * @returns Accuracy percentage
   */
  async validatePIIDetection(testCases: Array<{
    text: string;
    expectedEntities: PIIEntity[];
  }>): Promise<number> {
    let correctDetections = 0;
    let totalExpected = 0;

    for (const testCase of testCases) {
      const detected = await this.detectPII(testCase.text);
      totalExpected += testCase.expectedEntities.length;

      for (const expected of testCase.expectedEntities) {
        const found = detected.find(d => 
          d.type === expected.type && 
          d.start === expected.start && 
          d.end === expected.end
        );
        if (found) {
          correctDetections++;
        }
      }
    }

    const accuracy = totalExpected > 0 ? (correctDetections / totalExpected) * 100 : 100;
    logger.info(`PII detection validation completed - accuracy: ${accuracy.toFixed(2)}%`, this.context);
    return accuracy;
  }
}

/**
 * Factory function to create privacy service
 * @param encryptionKey - Optional encryption key
 * @returns PrivacyService instance
 */
export function createPrivacyService(encryptionKey?: string): PrivacyService {
  return new PrivacyService(encryptionKey);
}