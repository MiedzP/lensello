import { signOut } from '@/app/login/actions';

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="mt-2 w-full rounded-md px-3 py-1.5 text-left text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        Sign out
      </button>
    </form>
  );
}
