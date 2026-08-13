import { signOut } from './actions';

export function PortalSignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-md border border-subtle px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        Sign out
      </button>
    </form>
  );
}
