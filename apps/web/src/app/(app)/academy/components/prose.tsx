import { cn } from '@/lib/utils';

/**
 * Styling for rendered lesson markdown, expressed as arbitrary-variant
 * Tailwind selectors on the wrapper rather than a `prose` typography plugin
 * (not installed — `apps/web/package.json` is frozen for this round) or new
 * rules in `globals.css` (also frozen — shared design tokens). Every value
 * comes from the same semantic tokens the rest of the app uses, so this
 * still tracks light/dark rather than hardcoding a palette.
 */
const CONTENT_CLASSES = cn(
  'max-w-none text-[0.95rem] leading-relaxed text-foreground',
  '[&>*+*]:mt-4',
  '[&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-foreground',
  '[&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground',
  '[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground',
  '[&_h4]:mt-5 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-foreground',
  '[&_p]:text-foreground',
  '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-accent-hover',
  '[&_strong]:font-semibold [&_strong]:text-foreground',
  '[&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1',
  '[&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1',
  '[&_li]:text-foreground',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_blockquote]:italic',
  '[&_hr]:my-6 [&_hr]:border-subtle',
  '[&_code]:rounded [&_code]:bg-surface-raised [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-foreground',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-subtle [&_pre]:bg-surface-raised [&_pre]:p-4',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_img]:my-2 [&_img]:rounded-md [&_img]:border [&_img]:border-subtle',
);

/**
 * Renders HTML produced by `renderLessonMarkdown`. Safe to use
 * `dangerouslySetInnerHTML` here specifically because that function escapes
 * the source before re-introducing any markup — see `lib/academy/markdown.ts`.
 * Never pass raw `body_md` (or any other untrusted string) to this component.
 */
export function LessonContent({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(CONTENT_CLASSES, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
