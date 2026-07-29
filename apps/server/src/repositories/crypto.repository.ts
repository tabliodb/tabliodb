import { Injectable } from '@nestjs/common';
import { compareSync, hash } from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

@Injectable()
export class CryptoRepository {
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
}
