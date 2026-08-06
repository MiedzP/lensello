'use client';

import { useState } from 'react';
import { Badge, Button, Card, CardBody, Input } from '@/components/ui';
import { Check, Copy, Link2 } from 'lucide-react';

/**
 * The enquiry form, presented as what it is: a working channel.
 *
 * It was buried — a route with no mention anywhere in the app, while the
 * Connections page led with four social platforms that were all simulated. The
 * one thing on this page that genuinely brings client enquiries in, today,
 * with nobody's approval, was the one thing not on it.
 */
export function EnquiryFormCard() {
  const [copied, setCopied] = useState(false);
  const url = typeof window === 'undefined' ? '/inquire' : `${window.location.origin}/inquire`;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Link2 size={15} aria-hidden="true" />
              Enquiry form
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              A public page anyone can fill in. Nothing to set up.
            </p>
          </div>
          <Badge tone="success">Live</Badge>
        </div>

        <p className="text-xs text-muted">
          Put this link in your Instagram bio, on your website, or on a card.
          Every submission creates a client, files the enquiry in your reply
          queue, checks the requested date against your calendar, and emails you.
        </p>

        <div className="flex gap-2">
          <Input readOnly value={url} onFocus={(event) => event.target.select()} />
          <Button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(() => setCopied(true));
            }}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <p className="text-xs text-faint">
          Works whether or not anything else on this page is connected — it
          writes straight into Clients rather than going through a platform.
        </p>
      </CardBody>
    </Card>
  );
}
