import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PREFIX = 'enc:v1:';

/**
 * Encrypts secrets at rest without SECRETS_MASTER_KEY in .env.
 * Auto-creates `.data/secrets.key` on first use (gitignored).
 */
@Injectable()
export class SecretsCryptoService {
  private readonly logger = new Logger(SecretsCryptoService.name);
  private key: Buffer | null = null;

  encrypt(plaintext: string | null | undefined): string | null | undefined {
    if (plaintext == null || plaintext === '') {
      return plaintext;
    }
    if (plaintext.startsWith(PREFIX)) {
      return plaintext;
    }

    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(value: string | null | undefined): string | null | undefined {
    if (value == null || value === '') {
      return value;
    }
    // Legacy plaintext rows still work until re-saved
    if (!value.startsWith(PREFIX)) {
      return value;
    }

    const parts = value.split(':');
    // enc:v1:<iv>:<tag>:<data>
    const ivHex = parts[2];
    const tagHex = parts[3];
    const dataHex = parts[4];
    if (!ivHex || !tagHex || !dataHex) {
      throw new Error('Invalid encrypted secret format.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getKey(),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  mask(value: string | null | undefined, visible = 8): string | null {
    if (value == null) {
      return null;
    }
    const plain = this.decrypt(value) ?? value;
    if (plain.length <= visible) {
      return '****';
    }
    return `${plain.slice(0, visible)}…****`;
  }

  private getKey(): Buffer {
    if (!this.key) {
      this.key = this.loadOrCreateKey();
    }
    return this.key;
  }

  private loadOrCreateKey(): Buffer {
    const dir = join(process.cwd(), '.data');
    const file = join(dir, 'secrets.key');

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(file)) {
      const raw = readFileSync(file, 'utf8').trim();
      return createHash('sha256').update(raw).digest();
    }

    const generated = randomBytes(32).toString('hex');
    writeFileSync(file, generated, { encoding: 'utf8', mode: 0o600 });
    this.logger.log(
      'Created .data/secrets.key for encrypting secrets (do not commit this file).',
    );
    return createHash('sha256').update(generated).digest();
  }
}
