import { Injectable } from '@nestjs/common';
import { compareSync, hash } from 'bcrypt';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { ConfigRepository } from './config.repository.js';
import type { JsonValue } from '../schema/index.js';

const secretEnvelopeVersion = 1;
const secretEncryptionAlgorithm = 'aes-256-gcm';
const secretKeyByteLength = 32;
const secretIvByteLength = 12;
const secretAuthTagByteLength = 16;
const localDevelopmentSecretKeySeed = 'tabliodb-local-development-secret-key';

type SecretEnvelope = {
  algorithm: typeof secretEncryptionAlgorithm;
  ciphertext: string;
  encrypted: true;
  iv: string;
  keyId: string;
  tag: string;
  version: typeof secretEnvelopeVersion;
};

@Injectable()
export class CryptoRepository {
  constructor(private readonly configRepository: ConfigRepository) {}

  randomUUID(): string {
    return randomUUID();
  }

  randomBytesAsText(bytes: number): string {
    return randomBytes(bytes).toString('base64url');
  }

  hashSha256(value: string): Buffer {
    return createHash('sha256').update(value).digest();
  }

  hashBcrypt(value: string, saltRounds: number): Promise<string> {
    return hash(value, saltRounds);
  }

  compareBcrypt(value: string, encrypted: string): boolean {
    return compareSync(value, encrypted);
  }

  encryptJsonSecret(value: JsonValue, associatedData: string): JsonValue {
    const key = this.getSecretEncryptionKey();
    const iv = randomBytes(secretIvByteLength);
    const cipher = createCipheriv(secretEncryptionAlgorithm, key, iv, {
      authTagLength: secretAuthTagByteLength,
    });

    // Binding ciphertext to its setting key prevents a copied encrypted value from being valid under another system setting.
    cipher.setAAD(Buffer.from(associatedData));

    const plaintext = JSON.stringify(value);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      algorithm: secretEncryptionAlgorithm,
      ciphertext: ciphertext.toString('base64url'),
      encrypted: true,
      iv: iv.toString('base64url'),
      keyId: this.createSecretKeyId(key),
      tag: tag.toString('base64url'),
      version: secretEnvelopeVersion,
    } satisfies SecretEnvelope;
  }

  decryptJsonSecret(envelope: JsonValue, associatedData: string): JsonValue {
    if (!isSecretEnvelope(envelope)) {
      throw new Error('Encrypted secret payload is invalid or uses an unsupported format.');
    }

    const key = this.getSecretEncryptionKey();
    const decipher = createDecipheriv(secretEncryptionAlgorithm, key, Buffer.from(envelope.iv, 'base64url'), {
      authTagLength: secretAuthTagByteLength,
    });

    // The same associated data used during encryption must be supplied so settings cannot be swapped silently.
    decipher.setAAD(Buffer.from(associatedData));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(plaintext) as JsonValue;
  }

  isEncryptedJsonSecret(value: JsonValue): boolean {
    return isSecretEnvelope(value);
  }

  private getSecretEncryptionKey(): Buffer {
    const configuredKey = this.configRepository.getEnv().secrets.encryptionKey?.trim();

    if (!configuredKey) {
      if (this.configRepository.isDevelopment()) {
        return createHash('sha256').update(localDevelopmentSecretKeySeed).digest();
      }

      throw new Error('TABLIODB_SECRET_KEY is required before encrypted system secrets can be used.');
    }

    const decodedKey = decodeConfiguredSecretKey(configuredKey);

    if (decodedKey.length === secretKeyByteLength) {
      return decodedKey;
    }

    // A passphrase-style key is still accepted, but it is normalized to the 32 bytes AES-256-GCM requires.
    return createHash('sha256').update(configuredKey).digest();
  }

  private createSecretKeyId(key: Buffer): string {
    return createHash('sha256').update(key).digest('base64url').slice(0, 16);
  }
}

function decodeConfiguredSecretKey(value: string): Buffer {
  if (/^[a-f0-9]{64}$/i.test(value)) {
    return Buffer.from(value, 'hex');
  }

  const normalized = value.replace(/^base64url:/i, '').replace(/^base64:/i, '');

  try {
    return Buffer.from(normalized, 'base64url');
  } catch {
    return Buffer.from(value, 'utf8');
  }
}

function isSecretEnvelope(value: JsonValue): value is SecretEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const envelope = value as Record<string, JsonValue>;

  return (
    envelope.encrypted === true &&
    envelope.algorithm === secretEncryptionAlgorithm &&
    envelope.version === secretEnvelopeVersion &&
    typeof envelope.iv === 'string' &&
    typeof envelope.tag === 'string' &&
    typeof envelope.ciphertext === 'string' &&
    typeof envelope.keyId === 'string'
  );
}
