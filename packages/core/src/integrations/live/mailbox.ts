/**
 * Live mail adapter: the studio's own mailbox, over IMAP and SMTP.
 *
 * Replies leave from the studio's real address, so they thread in the client's
 * mail app and a reply comes back to the inbox the photographer already
 * watches. A transactional provider cannot do that — mail from it arrives from
 * a different address and starts a new thread.
 *
 * Unlike every other adapter here, this one is constructed per request from
 * credentials in the database rather than from the environment: the mailbox is
 * something a user connects in the UI, not something the deployment is
 * configured with.
 *
 * NOT VERIFIED against a live mailbox — that needs a real account and an app
 * password. The request shapes are standard IMAP/SMTP via imapflow and
 * nodemailer, and `testConnection` exists so the first attempt reports a
 * precise reason rather than failing later inside a sync.
 */

import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { IntegrationError } from '../types';
import type { Timestamp } from '../../types';
import type {
  InboundMessage,
  MailClient,
  PublishResult,
  SendMailInput,
} from '../types';

export interface MailboxConfig {
  emailAddress: string;
  displayName: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

/** How far back a sync looks when the mailbox has never been synced. */
const FIRST_SYNC_DAYS = 14;
/** Bounded so a mailbox with 40k messages does not stall the first sync. */
const MAX_MESSAGES = 100;

/**
 * Sensible IMAP/SMTP hosts for the providers a photography studio actually
 * uses, so the connect form is an address and a password rather than six
 * fields nobody knows the answers to. Anything unrecognised must be entered
 * by hand, which is honest — guessing `mail.<domain>` is wrong often enough
 * to be worse than asking.
 */
const KNOWN_HOSTS: Record<
  string,
  { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }
> = {
  'gmail.com': { imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465 },
  'googlemail.com': { imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465 },
  'outlook.com': { imapHost: 'outlook.office365.com', imapPort: 993, smtpHost: 'smtp.office365.com', smtpPort: 587 },
  'hotmail.com': { imapHost: 'outlook.office365.com', imapPort: 993, smtpHost: 'smtp.office365.com', smtpPort: 587 },
  'live.com': { imapHost: 'outlook.office365.com', imapPort: 993, smtpHost: 'smtp.office365.com', smtpPort: 587 },
  'office365.com': { imapHost: 'outlook.office365.com', imapPort: 993, smtpHost: 'smtp.office365.com', smtpPort: 587 },
  'yahoo.com': { imapHost: 'imap.mail.yahoo.com', imapPort: 993, smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465 },
  'icloud.com': { imapHost: 'imap.mail.me.com', imapPort: 993, smtpHost: 'smtp.mail.me.com', smtpPort: 587 },
  'me.com': { imapHost: 'imap.mail.me.com', imapPort: 993, smtpHost: 'smtp.mail.me.com', smtpPort: 587 },
  'zoho.com': { imapHost: 'imap.zoho.com', imapPort: 993, smtpHost: 'smtp.zoho.com', smtpPort: 465 },
  'fastmail.com': { imapHost: 'imap.fastmail.com', imapPort: 993, smtpHost: 'smtp.fastmail.com', smtpPort: 465 },
};

export function guessHosts(
  emailAddress: string,
): { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number } | null {
  const domain = emailAddress.split('@')[1]?.trim().toLowerCase();
  if (!domain) return null;
  return KNOWN_HOSTS[domain] ?? null;
}

/**
 * Turns a provider's error into something actionable.
 *
 * "Invalid credentials" from Gmail almost always means a normal password was
 * used where an app password is required, and saying so directly saves a long
 * detour through account settings.
 */
function explain(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);

  if (/invalid credentials|authentication failed|auth.*fail|535|LOGIN failed/i.test(message)) {
    return (
      'The mailbox rejected those credentials. If this is Gmail, Outlook, or ' +
      'iCloud, you need an app password rather than your normal password, and ' +
      'two-factor authentication has to be on.'
    );
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) {
    return 'That mail server hostname could not be resolved. Check the IMAP and SMTP hosts.';
  }
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(message)) {
    return 'The mail server did not answer. Check the ports, or whether the provider allows IMAP access.';
  }
  if (/certificate|self.signed|SSL|TLS/i.test(message)) {
    return 'The mail server’s TLS certificate could not be verified.';
  }
  return message;
}

function textFromSource(source: Buffer): { subject: string; body: string; from: string; date: string; messageId: string } {
  // Deliberately a light header parse rather than a full MIME library. The
  // fields used here are the ones that decide filing — sender, id, date — and
  // the body only needs to be readable by a human in the reply queue.
  const raw = source.toString('utf8');
  const split = raw.indexOf('\r\n\r\n');
  const headerBlock = split === -1 ? raw : raw.slice(0, split);
  const bodyBlock = split === -1 ? '' : raw.slice(split + 4);

  // Unfold continuation lines before matching, or a wrapped Subject truncates.
  const headers = headerBlock.replace(/\r\n[ \t]+/g, ' ');

  const header = (name: string): string => {
    const match = headers.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'));
    return match?.[1]?.trim() ?? '';
  };

  return {
    subject: header('Subject'),
    from: header('From'),
    date: header('Date'),
    messageId: header('Message-ID'),
    body: bodyBlock.trim(),
  };
}

/** `Name <addr@host>` or a bare address. */
function parseAddress(value: string): { name: string; email: string } {
  const angled = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (angled) {
    return { name: angled[1]?.trim() ?? '', email: angled[2]!.trim().toLowerCase() };
  }
  return { name: '', email: value.trim().toLowerCase() };
}

class MailboxClient implements MailClient {
  readonly provider = 'mailbox';

  constructor(private readonly config: MailboxConfig) {}

  private imap(): ImapFlow {
    return new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: this.config.imapPort === 993,
      auth: { user: this.config.emailAddress, pass: this.config.password },
      // The library logs every command at info level otherwise, which puts
      // message subjects into the platform logs.
      logger: false,
    });
  }

  private transport() {
    return nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpPort === 465,
      auth: { user: this.config.emailAddress, pass: this.config.password },
    });
  }

  /**
   * Proves both directions work before anything is stored.
   *
   * Checking IMAP alone would let a mailbox be saved that can read but never
   * reply, and the failure would only surface when a photographer tried to
   * answer a client.
   */
  async testConnection(): Promise<void> {
    const client = this.imap();
    try {
      await client.connect();
      await client.getMailboxLock('INBOX').then((lock) => lock.release());
    } catch (cause) {
      throw new IntegrationError(explain(cause), 'mailbox');
    } finally {
      await client.logout().catch(() => undefined);
    }

    try {
      await this.transport().verify();
    } catch (cause) {
      throw new IntegrationError(`Sending failed: ${explain(cause)}`, 'mailbox');
    }
  }

  async fetchInbox(since?: Timestamp): Promise<InboundMessage[]> {
    const client = this.imap();
    const messages: InboundMessage[] = [];

    const cutoff = since
      ? new Date(since)
      : new Date(Date.now() - FIRST_SYNC_DAYS * 24 * 60 * 60 * 1000);

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        // IMAP SINCE has day granularity, so this over-fetches. The caller
        // dedupes on external_id, which makes that free — and under-fetching
        // would silently lose an enquiry.
        const uids = await client.search({ since: cutoff }, { uid: true });
        const recent = (uids || []).slice(-MAX_MESSAGES);

        for await (const message of client.fetch(
          recent.length > 0 ? recent : '1:0',
          { uid: true, source: true },
          { uid: true },
        )) {
          if (!message.source) continue;

          const parsed = textFromSource(message.source as Buffer);
          const sender = parseAddress(parsed.from);
          if (!sender.email) continue;

          // Prefer the RFC Message-ID: it is stable across refetches and
          // across clients, where a UID is only stable within this mailbox.
          const externalId = parsed.messageId || `uid:${message.uid}`;

          const received = parsed.date ? new Date(parsed.date) : new Date();

          messages.push({
            externalId,
            fromName: sender.name,
            fromEmail: sender.email,
            subject: parsed.subject,
            body: parsed.body,
            receivedAt: (Number.isNaN(received.getTime()) ? new Date() : received).toISOString(),
          });
        }
      } finally {
        lock.release();
      }
    } catch (cause) {
      throw new IntegrationError(explain(cause), 'mailbox', true);
    } finally {
      await client.logout().catch(() => undefined);
    }

    return messages.sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
    );
  }

  async send(input: SendMailInput): Promise<PublishResult> {
    try {
      const result = await this.transport().sendMail({
        from: this.config.displayName
          ? `"${this.config.displayName}" <${this.config.emailAddress}>`
          : this.config.emailAddress,
        to: input.toName ? `"${input.toName}" <${input.toEmail}>` : input.toEmail,
        subject: input.subject,
        text: input.body,
        // Both headers: In-Reply-To threads it, References keeps the whole
        // conversation together in clients that walk the chain.
        ...(input.inReplyTo
          ? { inReplyTo: input.inReplyTo, references: [input.inReplyTo] }
          : {}),
      });

      return {
        externalId: result.messageId,
        url: null,
        publishedAt: new Date().toISOString(),
      };
    } catch (cause) {
      throw new IntegrationError(explain(cause), 'mailbox', true);
    }
  }
}

export function createMailboxClient(config: MailboxConfig): MailClient & {
  testConnection(): Promise<void>;
} {
  return new MailboxClient(config);
}
