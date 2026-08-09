import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { SetupRepository, type SmtpSettings } from '../repositories/setup.repository.js';
import type { JsonValue } from '../schema/index.js';

export type MailAddress = {
  email: string;
  name?: string | null;
};

export type TransactionalMailMessage = {
  html?: string;
  subject: string;
  text: string;
  to: MailAddress[];
};

export type MailDeliveryResult =
  | {
      messageId: string | null;
      recipientCount: number;
      status: 'sent';
    }
  | {
      reason: 'no_recipients' | 'smtp_disabled';
      recipientCount: number;
      status: 'skipped';
    };

@Injectable()
export class MailService {
  constructor(private readonly setupRepository: SetupRepository) {}

  async sendTransactionalMail(message: TransactionalMailMessage): Promise<MailDeliveryResult> {
    if (message.to.length === 0) {
      return {
        reason: 'no_recipients',
        recipientCount: 0,
        status: 'skipped',
      };
    }

    const settings = await this.setupRepository.getSmtpSettings();
    if (!settings.enabled) {
      return {
        reason: 'smtp_disabled',
        recipientCount: message.to.length,
        status: 'skipped',
      };
    }

    this.assertSmtpSettingsReady(settings);

    const password = await this.readSmtpPassword(settings);
    const transporter = createTransport({
      auth: settings.username
        ? {
            pass: password,
            user: settings.username,
          }
        : undefined,
      connectionTimeout: 10_000,
      host: settings.host ?? undefined,
      port: settings.port ?? undefined,
      requireTLS: settings.security === 'starttls',
      secure: settings.security === 'tls',
    });
    const info = await transporter.sendMail({
      from: formatAddress({
        email: settings.fromEmail ?? '',
        name: settings.fromName,
      }),
      html: message.html,
      replyTo: settings.replyToEmail ?? undefined,
      subject: message.subject,
      text: message.text,
      to: message.to.map(formatAddress),
    });

    return {
      messageId: typeof info.messageId === 'string' ? info.messageId : null,
      recipientCount: message.to.length,
      status: 'sent',
    };
  }

  private async readSmtpPassword(settings: SmtpSettings): Promise<string | undefined> {
    if (!settings.username) {
      return undefined;
    }

    const secret = await this.setupRepository.getSecretSettingValue('mail.smtp.password');
    const password = readPasswordSecret(secret);

    if (!password) {
      // Enabled authenticated SMTP without a secret means the instance config is inconsistent and should retry/fail loudly.
      throw new Error('SMTP password is required when SMTP username is configured.');
    }

    return password;
  }

  private assertSmtpSettingsReady(settings: SmtpSettings): void {
    if (!settings.host || !settings.port || !settings.fromEmail) {
      // A broken enabled SMTP config should fail background jobs loudly so admins see retry/dead job evidence.
      throw new Error('SMTP host, port, and from email are required when SMTP is enabled.');
    }
  }
}

function readPasswordSecret(secret: JsonValue | null): string | undefined {
  if (!secret || typeof secret !== 'object' || Array.isArray(secret)) {
    return undefined;
  }

  const value = (secret as Record<string, JsonValue>).password;

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function formatAddress(address: MailAddress): string {
  if (!address.name?.trim()) {
    return address.email;
  }

  return `${quoteAddressName(address.name.trim())} <${address.email}>`;
}

function quoteAddressName(name: string): string {
  return `"${name.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}
