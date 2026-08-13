/** Channel and status vocabulary for the inbox: labels, tones, and what can actually send. */

import type { Tone } from '@/components/ui';
import type { Tables } from '@/lib/db.types';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@lensello/core';

export type MessageChannel = Tables<'messages'>['channel'];
export type ConversationStatus = Tables<'conversations'>['status'];

export const MESSAGE_CHANNELS: readonly MessageChannel[] = [
  'email',
  'form',
  'instagram',
  'facebook',
  'tiktok',
  'pinterest',
  'sms',
  'whatsapp',
  'comment',
];

export const CHANNEL_LABELS: Record<MessageChannel, string> = {
  email: 'Email',
  form: 'Inquiry form',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  comment: 'Comment',
};

export const CHANNEL_TONES: Record<MessageChannel, Tone> = {
  email: 'neutral',
  form: 'neutral',
  instagram: 'accent',
  facebook: 'accent',
  tiktok: 'accent',
  pinterest: 'accent',
  sms: 'warning',
  whatsapp: 'warning',
  comment: 'neutral',
};

export const CONVERSATION_STATUSES: readonly ConversationStatus[] = [
  'open',
  'snoozed',
  'closed',
];

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: 'Open',
  snoozed: 'Snoozed',
  closed: 'Closed',
};

export const STATUS_TONES: Record<ConversationStatus, Tone> = {
  open: 'accent',
  snoozed: 'warning',
  closed: 'neutral',
};

function isSocialPlatform(channel: MessageChannel): channel is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(channel);
}

/**
 * Whether replying in-thread on this channel goes anywhere.
 *
 * Mail and the four social platforms have a real adapter behind them —
 * `getIntegrations().mail` / `.social`. Everything else (`sms`, `whatsapp`,
 * `form`, `comment`) is a channel the schema can represent and the UI can
 * filter by, with no adapter to send through — see the module report. The
 * composer must say that plainly rather than trying and failing, or appearing
 * to send when it did not.
 */
export function isSendableChannel(
  channel: MessageChannel,
): channel is 'email' | SocialPlatform {
  return channel === 'email' || isSocialPlatform(channel);
}

export function unsendableChannelReason(channel: MessageChannel): string | null {
  if (isSendableChannel(channel)) return null;
  switch (channel) {
    case 'sms':
      return 'There is no SMS adapter yet, so a reply here cannot be sent. Reply by another channel, or call the client directly.';
    case 'whatsapp':
      return 'There is no WhatsApp adapter yet, so a reply here cannot be sent.';
    case 'comment':
      return 'Public comments are read-only here for now — reply on the post directly, or message the client on a channel with a working adapter.';
    case 'form':
      return 'An inquiry form submission has no reply channel of its own — reply by email once you know their address.';
    default:
      return 'This channel has no working adapter yet, so a reply cannot be sent from here.';
  }
}
