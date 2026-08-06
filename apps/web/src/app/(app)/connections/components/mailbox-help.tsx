'use client';

import { ExternalLink } from 'lucide-react';

/**
 * Step-by-step for getting an app password, per provider.
 *
 * The form used to say "you need an app password" and link to a settings page,
 * which assumes the reader already knows what one is and why their normal
 * password will not do. That assumption is wrong for most photographers, and
 * the failure it produces is the confusing kind: the mailbox rejects a
 * perfectly correct password and it looks like the app is broken.
 *
 * The steps appear as soon as the address is recognised, so nobody has to go
 * looking for the right instructions among five providers'.
 */

interface Guide {
  provider: string;
  /** Where two-factor lives, since no provider issues app passwords without it. */
  twoFactorUrl: string;
  appPasswordUrl: string;
  steps: string[];
}

const GUIDES: Array<{ match: RegExp; guide: Guide }> = [
  {
    match: /@(gmail|googlemail)\.com$/i,
    guide: {
      provider: 'Gmail',
      twoFactorUrl: 'https://myaccount.google.com/security',
      appPasswordUrl: 'https://myaccount.google.com/apppasswords',
      steps: [
        'Turn on 2-Step Verification if it is not already on. Google will not offer app passwords without it.',
        'Open the app passwords page. If it says the setting is unavailable, 2-Step Verification has not finished setting up — go back and complete it.',
        'Type a name you will recognise later, such as "Lensello", and press Create.',
        'Google shows a 16-character password once. Copy it now; you cannot see it again.',
        'Paste it into the box below. The spaces do not matter — they get stripped.',
      ],
    },
  },
  {
    match: /@(outlook|hotmail|live|msn)\.[a-z.]+$/i,
    guide: {
      provider: 'Outlook',
      twoFactorUrl: 'https://account.microsoft.com/security',
      appPasswordUrl: 'https://account.microsoft.com/security',
      steps: [
        'Open Security, then "Advanced security options".',
        'Turn on Two-step verification and finish the setup.',
        'Scroll to "App passwords" and choose "Create a new app password".',
        'Copy the password it shows and paste it below.',
      ],
    },
  },
  {
    match: /@(icloud|me|mac)\.com$/i,
    guide: {
      provider: 'iCloud',
      twoFactorUrl: 'https://account.apple.com',
      appPasswordUrl: 'https://account.apple.com',
      steps: [
        'Sign in and open "Sign-In and Security".',
        'Two-factor authentication is already on for most Apple IDs. If it is not, turn it on first.',
        'Choose "App-Specific Passwords", then the plus button.',
        'Label it "Lensello", copy the password, and paste it below.',
      ],
    },
  },
  {
    match: /@yahoo\.[a-z.]+$/i,
    guide: {
      provider: 'Yahoo',
      twoFactorUrl: 'https://login.yahoo.com/account/security',
      appPasswordUrl: 'https://login.yahoo.com/account/security',
      steps: [
        'Open Account Security and turn on two-step verification.',
        'Choose "Generate app password" (sometimes under "Manage app passwords").',
        'Pick "Other app", name it Lensello, and generate.',
        'Copy the password and paste it below.',
      ],
    },
  },
  {
    match: /@fastmail\.[a-z.]+$/i,
    guide: {
      provider: 'Fastmail',
      twoFactorUrl: 'https://app.fastmail.com/settings/security/passwords',
      appPasswordUrl: 'https://app.fastmail.com/settings/security/passwords',
      steps: [
        'Open Settings, then "Password & Security", then "App Passwords".',
        'Create a new app password and give it access to Mail (IMAP/SMTP).',
        'Copy the password and paste it below.',
      ],
    },
  },
  {
    match: /@zoho\.[a-z.]+$/i,
    guide: {
      provider: 'Zoho',
      twoFactorUrl: 'https://accounts.zoho.com/home#security',
      appPasswordUrl: 'https://accounts.zoho.com/home#security',
      steps: [
        'Open Security and turn on Multi-Factor Authentication.',
        'Choose "App Passwords", then "Generate New Password".',
        'Name it Lensello, copy the password, and paste it below.',
      ],
    },
  },
];

export function MailboxHelp({ email }: { email: string }) {
  const found = GUIDES.find((entry) => entry.match.test(email.trim()));

  return (
    <div className="rounded-md border border-subtle bg-surface-raised p-4">
      <p className="text-sm font-medium text-foreground">
        {found
          ? `Getting an app password from ${found.guide.provider}`
          : 'Getting an app password'}
      </p>

      <p className="mt-1 text-xs text-muted">
        Not your normal email password. An app password is a separate one that
        works for this app only, and you can revoke it later without changing
        anything else. Providers only issue them once two-factor authentication
        is on — that is a rule of theirs, not ours.
      </p>

      {found ? (
        <>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-muted">
            {found.guide.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>

          <div className="mt-3 flex flex-wrap gap-3">
            <a
              href={found.guide.twoFactorUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Security settings
              <ExternalLink size={11} aria-hidden="true" />
            </a>
            {found.guide.appPasswordUrl !== found.guide.twoFactorUrl ? (
              <a
                href={found.guide.appPasswordUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                App passwords
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </>
      ) : (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-muted">
          <li>
            Type your email address above and these steps will change to match
            your provider.
          </li>
          <li>
            For anything else: turn on two-factor authentication in your mail
            account&rsquo;s security settings, then look for &ldquo;app
            password&rdquo;, &ldquo;application password&rdquo;, or
            &ldquo;device password&rdquo;.
          </li>
          <li>
            You will also need your provider&rsquo;s IMAP and SMTP hostnames —
            open <span className="text-foreground">Server settings</span> below
            to enter them.
          </li>
        </ol>
      )}

      <p className="mt-3 border-t border-subtle pt-3 text-xs text-muted">
        <span className="text-foreground">What this gives Lensello:</span> read
        and send access to that mailbox. It is stored encrypted and no signed-in
        user can read it back. You can revoke the app password at your provider
        at any time — it takes effect immediately and affects nothing else on
        your account.
      </p>
    </div>
  );
}
