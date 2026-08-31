/**
 * Payment Credentials Encryption Service
 *
 * This module handles secure encryption and decryption of sensitive payment
 * provider credentials using AES-256-GCM (Galois/Counter Mode).
 *
 * AES-256-GCM provides:
 * - Confidentiality: Credentials are encrypted
 * - Authenticity: Can detect if encrypted data has been tampered with
 * - 256-bit encryption strength
 *
 * IMPORTANT:
 * - The encryption key (LENSELLO_ENCRYPTION_KEY) must be:
 *   - 32 bytes (256 bits) exactly
 *   - Stored securely in environment variables
 *   - Never logged or exposed
 *   - Rotated periodically
 *
 * - Decrypted credentials are held in memory only
 * - Never persist decrypted credentials to disk
 * - Never log decrypted credentials
 * - Clear from memory after use (handled by GC)
 *
 * Usage:
 *   const service = new PaymentEncryptionService();
 *   const encrypted = await service.encryptCredentials({ apiKey: '...' });
 *   // ... store encrypted in DB ...
 *   const decrypted = await service.decryptCredentials(encrypted);
 */

import crypto from 'crypto';

/**
 * Configuration for encryption operations
 */
const ENCRYPTION_CONFIG = {
  // AES-256-GCM algorithm
  algorithm: 'aes-256-gcm' as const,
  // IV (Initialization Vector) length in bytes
  // 12 bytes (96 bits) is recommended for GCM
  ivLength: 12,
  // Authentication tag length in bytes
  // 16 bytes (128 bits) provides strong authentication
  tagLength: 16,
  // PBKDF2 configuration for key derivation (if needed)
  keyDerivation: {
    iterations: 100000,
    hashAlgorithm: 'sha256',
    saltLength: 16
  }
};

/**
 * Error class for encryption/decryption failures
 */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Encrypted data object
 * Contains all necessary information to decrypt
 */
interface EncryptedData {
  // IV used for encryption (included for decryption)
  iv: string;
  // Encrypted data (base64 encoded)
  data: string;
  // Authentication tag (base64 encoded)
  tag: string;
}

/**
 * Payment Encryption Service
 *
 * Handles secure encryption and decryption of payment credentials
 */
export class PaymentEncryptionService {
  private encryptionKey: Buffer;

  constructor() {
    // Get encryption key from environment
    const keyString = process.env.LENSELLO_ENCRYPTION_KEY;

    if (!keyString) {
      throw new EncryptionError(
        'LENSELLO_ENCRYPTION_KEY environment variable is not set',
        'MISSING_ENCRYPTION_KEY'
      );
    }

    // Convert key from environment (usually base64 or hex)
    try {
      // Try base64 first (most common for env vars)
      this.encryptionKey = Buffer.from(keyString, 'base64');

      // Validate key length
      if (this.encryptionKey.length !== 32) {
        throw new EncryptionError(
          `Encryption key must be 32 bytes (256 bits). Got ${this.encryptionKey.length} bytes.`,
          'INVALID_KEY_LENGTH'
        );
      }
    } catch (error) {
      if (error instanceof EncryptionError) throw error;

      throw new EncryptionError(
        'Failed to parse LENSELLO_ENCRYPTION_KEY. Must be base64 encoded 32-byte key.',
        'INVALID_KEY_FORMAT'
      );
    }
  }

  /**
   * Encrypt payment credentials
   *
   * Steps:
   * 1. Generate random IV (initialization vector)
   * 2. Create cipher with algorithm, key, and IV
   * 3. Encrypt the JSON-stringified credentials
   * 4. Get authentication tag
   * 5. Return IV, encrypted data, and tag (all needed for decryption)
   *
   * @param credentials - Object containing sensitive data
   * @returns Buffer containing encrypted data (can be stored in DB)
   * @throws EncryptionError if encryption fails
   */
  async encryptCredentials(
    credentials: Record<string, unknown>
  ): Promise<Buffer> {
    try {
      // Validate input
      if (!credentials || typeof credentials !== 'object') {
        throw new EncryptionError(
          'Credentials must be a non-null object',
          'INVALID_CREDENTIALS'
        );
      }

      // Generate random IV
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(
        ENCRYPTION_CONFIG.algorithm,
        this.encryptionKey,
        iv
      );

      // Encrypt credentials JSON
      const credentialsJson = JSON.stringify(credentials);
      let encrypted = cipher.update(credentialsJson, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Create structured encrypted data
      const encryptedData: EncryptedData = {
        iv: iv.toString('base64'),
        data: encrypted,
        tag: tag.toString('base64')
      };

      // Return as JSON buffer (can be stored as BYTEA in database)
      return Buffer.from(JSON.stringify(encryptedData), 'utf8');
    } catch (error) {
      if (error instanceof EncryptionError) throw error;

      const message = error instanceof Error ? error.message : String(error);
      throw new EncryptionError(
        `Encryption failed: ${message}`,
        'ENCRYPTION_FAILED'
      );
    }
  }

  /**
   * Decrypt payment credentials
   *
   * Steps:
   * 1. Parse encrypted data buffer to get IV, data, and tag
   * 2. Create decipher with algorithm, key, and IV
   * 3. Set authentication tag
   * 4. Decrypt the data
   * 5. Parse JSON back to object
   * 6. Return decrypted credentials
   *
   * @param encryptedBuffer - Buffer containing encrypted data (from DB)
   * @returns Object with decrypted credentials
   * @throws EncryptionError if decryption fails or authentication fails
   */
  async decryptCredentials(
    encryptedBuffer: Buffer
  ): Promise<Record<string, unknown>> {
    try {
      // Parse encrypted data
      const encryptedDataJson = encryptedBuffer.toString('utf8');
      const encryptedData: EncryptedData = JSON.parse(encryptedDataJson);

      // Extract components
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const encrypted = Buffer.from(encryptedData.data, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');

      // Validate components
      if (iv.length !== ENCRYPTION_CONFIG.ivLength) {
        throw new EncryptionError(
          `Invalid IV length: ${iv.length}, expected ${ENCRYPTION_CONFIG.ivLength}`,
          'INVALID_IV'
        );
      }

      if (tag.length !== ENCRYPTION_CONFIG.tagLength) {
        throw new EncryptionError(
          `Invalid tag length: ${tag.length}, expected ${ENCRYPTION_CONFIG.tagLength}`,
          'INVALID_TAG'
        );
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_CONFIG.algorithm,
        this.encryptionKey,
        iv
      );

      // Set authentication tag BEFORE updating with data
      decipher.setAuthTag(tag);

      // Decrypt
      let decrypted = decipher.update(encrypted, 'binary', 'utf8');
      decrypted += decipher.final('utf8');

      // Parse JSON
      const credentials = JSON.parse(decrypted);

      return credentials;
    } catch (error) {
      if (error instanceof EncryptionError) throw error;

      const message = error instanceof Error ? error.message : String(error);

      // Check if it's an authentication failure
      if (message.includes('Unsupported state or unable to authenticate data')) {
        throw new EncryptionError(
          'Authentication failed. Encrypted data may be corrupted or tampered with.',
          'AUTHENTICATION_FAILED'
        );
      }

      throw new EncryptionError(
        `Decryption failed: ${message}`,
        'DECRYPTION_FAILED'
      );
    }
  }

  /**
   * Generate a new encryption key
   *
   * Use this to generate initial encryption keys or for key rotation.
   * Output should be base64 encoded for environment variable usage.
   *
   * @returns Base64 encoded 32-byte encryption key
   */
  static generateEncryptionKey(): string {
    const key = crypto.randomBytes(32);
    return key.toString('base64');
  }

  /**
   * Verify encryption key format and length
   *
   * @param keyString - Base64 encoded key string
   * @returns true if valid, false otherwise
   */
  static isValidEncryptionKey(keyString: string): boolean {
    try {
      const key = Buffer.from(keyString, 'base64');
      return key.length === 32;
    } catch {
      return false;
    }
  }

  /**
   * Check if data appears to be encrypted
   *
   * Useful for migrations or checking data format
   * Note: This is a heuristic check, not cryptographic
   *
   * @param data - Buffer to check
   * @returns true if data looks like encrypted data from this service
   */
  static looksEncrypted(data: Buffer): boolean {
    try {
      const json = data.toString('utf8');
      const parsed = JSON.parse(json);

      // Check for expected structure
      return (
        typeof parsed.iv === 'string' &&
        typeof parsed.data === 'string' &&
        typeof parsed.tag === 'string' &&
        parsed.iv.length > 0 &&
        parsed.data.length > 0 &&
        parsed.tag.length > 0
      );
    } catch {
      return false;
    }
  }
}

/**
 * Factory function to create encryption service
 * Handles initialization and error handling
 *
 * @returns PaymentEncryptionService instance
 * @throws EncryptionError if key is not configured
 */
export function createPaymentEncryptionService(): PaymentEncryptionService {
  try {
    return new PaymentEncryptionService();
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(
      'Failed to initialize encryption service',
      'INITIALIZATION_FAILED'
    );
  }
}

/**
 * Helper middleware for Express/Next.js
 * Automatically initializes encryption service at startup
 *
 * Usage in Next.js:
 *   export const config = { runtime: 'nodejs' };
 *   import { initializeEncryption } from '@/lib/payments/encryption';
 *
 *   // Call once at startup
 *   const encService = initializeEncryption();
 */
let encryptionServiceInstance: PaymentEncryptionService | null = null;

export function initializeEncryption(): PaymentEncryptionService {
  if (encryptionServiceInstance) {
    return encryptionServiceInstance;
  }

  encryptionServiceInstance = createPaymentEncryptionService();
  return encryptionServiceInstance;
}

export function getEncryptionService(): PaymentEncryptionService {
  if (!encryptionServiceInstance) {
    throw new EncryptionError(
      'Encryption service not initialized. Call initializeEncryption() first.',
      'NOT_INITIALIZED'
    );
  }
  return encryptionServiceInstance;
}

/**
 * SECURITY BEST PRACTICES
 * =======================
 *
 * 1. KEY MANAGEMENT:
 *    - Generate key: PaymentEncryptionService.generateEncryptionKey()
 *    - Store in: LENSELLO_ENCRYPTION_KEY environment variable
 *    - Never commit to git
 *    - Rotate periodically (requires re-encrypting all stored credentials)
 *    - Use strong randomness source (crypto.randomBytes)
 *
 * 2. CREDENTIAL HANDLING:
 *    - Only decrypt when needed
 *    - Keep decrypted data in memory (don't persist)
 *    - Pass to payment providers securely
 *    - Clear from variables after use (handled by GC)
 *
 * 3. LOGGING:
 *    - Never log encrypted data (it may be decrypted in logs)
 *    - Never log decrypted credentials
 *    - Log only operations (e.g., "Encrypted credentials", "Decryption successful")
 *    - Use error codes instead of detailed messages in production
 *
 * 4. TRANSPORT:
 *    - Always use HTTPS/TLS
 *    - Encrypt credentials in transit
 *    - Verify TLS certificates
 *    - Use secure headers (HSTS, etc.)
 *
 * 5. STORAGE:
 *    - Credentials stored encrypted in database
 *    - Backup database with encryption at rest
 *    - Use database-level encryption if available
 *    - Audit access to credentials table
 *
 * 6. KEY ROTATION:
 *    - Plan key rotation schedule
 *    - Implement migration procedure
 *    - Test rotation in staging first
 *    - Never delete old key until all data migrated
 *    - Monitor decryption failures after rotation
 *
 * 7. TESTING:
 *    - Test encryption/decryption roundtrip
 *    - Test tampering detection (modify encrypted data)
 *    - Test with various credential sizes
 *    - Test error handling
 *    - Use test-specific encryption key in CI/CD
 *
 * 8. INCIDENT RESPONSE:
 *    - If key is exposed: Immediately rotate and re-encrypt
 *    - If data is tampered: Restore from backup
 *    - Log all access attempts to audit trail
 *    - Review access controls and permissions
 */
