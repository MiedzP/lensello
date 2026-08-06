import type { Metadata } from 'next';
import { FileText } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveContract } from '@/lib/contracts/queries';
import { AcceptForm } from './accept-form';

export const metadata: Metadata = {
  title: 'Agreement',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl px-6 py-12">{children}</div>;
}

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="py-16 text-center">
        <FileText size={26} className="mx-auto text-faint" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
      </div>
    </Shell>
  );
}

export default async function ContractPage(props: PageProps<'/c/[token]'>) {
  const { token } = await props.params;

  const admin = createAdminClient();
  const resolved = await resolveContract(admin, token);

  // Same message for a wrong token and a missing contract, so guessing tells
  // you nothing.
  if (!resolved) {
    return (
      <Closed
        title="Agreement not found"
        body="This link doesn't match an agreement. Check you have the whole address, or ask the studio to send it again."
      />
    );
  }

  const { contract, problem } = resolved;

  if (problem === 'void') {
    return (
      <Closed
        title="This agreement has been withdrawn"
        body="The studio has withdrawn it. Get in touch with them for an up-to-date version."
      />
    );
  }

  if (problem === 'draft') {
    return (
      <Closed
        title="Not ready yet"
        body="This agreement hasn't been sent for signing. The studio will be in touch."
      />
    );
  }

  if (problem === 'expired') {
    return (
      <Closed
        title="This agreement has expired"
        body="Ask the studio for a fresh link and you'll be able to sign it."
      />
    );
  }

  return (
    <Shell>
      <header className="mb-6 text-center">
        <FileText size={24} className="mx-auto text-accent" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
          {contract.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Please read this through before accepting.
        </p>
      </header>

      {/*
        The snapshot, rendered verbatim. Deliberately not markdown or rich
        text: what is displayed must be exactly the string that was stored and
        that acceptance is recorded against, with no rendering step in between
        that could show something other than what was agreed.
      */}
      <article className="mb-6 whitespace-pre-wrap rounded-lg border border-subtle bg-surface px-5 py-6 text-sm leading-relaxed text-foreground">
        {contract.body}
      </article>

      <AcceptForm
        token={token}
        alreadyAccepted={contract.status === 'accepted'}
        acceptedName={contract.accepted_name}
        acceptedAt={contract.accepted_at}
      />
    </Shell>
  );
}
