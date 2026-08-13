import { describe, expect, it } from 'vitest';
import { escapeHtml, plainTextExcerpt, renderLessonMarkdown } from './markdown';

/**
 * `body_md` is authored in-app and rendered straight into a signed-in page
 * via `dangerouslySetInnerHTML`. There is no sanitiser or markdown package in
 * this project to lean on (see the note in `markdown.ts`), so this file's
 * whole job is proving that a hostile lesson body cannot become a live tag,
 * a live event handler, or a live `javascript:` navigation — not that it
 * produces pretty output.
 */

describe('renderLessonMarkdown — no raw HTML injection', () => {
  it('never renders a literal <script> tag as markup', () => {
    const html = renderLessonMarkdown('Here is a tip.\n\n<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes an inline event handler attribute rather than emitting it live', () => {
    const html = renderLessonMarkdown('<img src=x onerror="alert(1)">');
    // The words "onerror=" are harmless as text content; what matters is that
    // there is no real <img> element for the browser to attach a handler to.
    expect(html).not.toMatch(/<img\b/);
    expect(html).toContain('&lt;img');
  });

  it('escapes a raw anchor tag with a javascript: href typed directly into the body', () => {
    const html = renderLessonMarkdown('<a href="javascript:alert(1)">click</a>');
    expect(html).not.toContain('<a href="javascript:');
    expect(html).toContain('&lt;a href=');
  });

  it('drops a markdown-syntax link whose target is a javascript: URL', () => {
    const html = renderLessonMarkdown('[click me](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<a ');
    expect(html).toContain('click me');
  });

  it('drops a markdown-syntax link whose target is a data: URL', () => {
    const html = renderLessonMarkdown('[open](data:text/html;base64,PHNjcmlwdD4=)');
    expect(html).not.toContain('data:');
    expect(html).not.toContain('<a ');
  });

  it('keeps a legitimate https link live', () => {
    const html = renderLessonMarkdown('[our site](https://example.com/pricing)');
    expect(html).toContain('<a href="https://example.com/pricing"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it('keeps a relative in-app link live', () => {
    const html = renderLessonMarkdown('[book a shoot](/gigs/new)');
    expect(html).toContain('<a href="/gigs/new"');
  });

  it('drops an image whose src is not http(s)', () => {
    const html = renderLessonMarkdown('![diagram](javascript:alert(1))');
    expect(html).not.toContain('<img');
    expect(html).toContain('diagram');
  });

  it('renders headings, emphasis, and lists as their whitelisted tags', () => {
    const html = renderLessonMarkdown('# Title\n\nSome **bold** and *italic* text.\n\n- one\n- two');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
  });

  it('does not run markdown formatting inside a fenced code block', () => {
    const html = renderLessonMarkdown('```\n**not bold** <b>not real html</b>\n```');
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<strong>');
    expect(html).not.toContain('<b>');
  });

  it('does not run bold/italic formatting inside an inline code span', () => {
    const html = renderLessonMarkdown('Use `**not bold**` here.');
    expect(html).toContain('<code>**not bold**</code>');
  });

  it('escapes an attempt to break out of the href attribute via a crafted link label', () => {
    const html = renderLessonMarkdown('[" onmouseover="alert(1)](https://example.com)');
    // The label text may legitimately contain the words "onmouseover=" — what
    // matters is that the quote inside it was escaped to &quot;, so it cannot
    // close the href attribute and start a new one.
    expect(html).toContain('<a href="https://example.com"');
    expect(html).not.toMatch(/href="https:\/\/example\.com"\s+onmouseover=/);
  });
});

describe('escapeHtml', () => {
  it('escapes the five characters that matter', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('plainTextExcerpt', () => {
  it('strips markdown syntax and truncates long text', () => {
    const excerpt = plainTextExcerpt('# Heading\n\nA fairly long paragraph. '.repeat(10), 40);
    expect(excerpt.length).toBeLessThanOrEqual(41);
    expect(excerpt).not.toContain('#');
  });
});
