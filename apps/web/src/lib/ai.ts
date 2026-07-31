import Anthropic from '@anthropic-ai/sdk';
import type { Prompt } from '@lensello/core/ai';

/**
 * Thin wrapper around the Anthropic SDK.
 *
 * Prompts are built by pure functions in `@lensello/core/ai`; this module only
 * calls them and parses the result. Every AI feature goes through
 * `generateJson` so JSON handling, truncation, and error shape are uniform.
 */

/**
 * Swap to 'claude-sonnet-5' via env if per-call cost matters more than copy
 * quality — the prompts are model-agnostic.
 */
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5';

export class AiError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiError(
      'ANTHROPIC_API_KEY is not set. AI generation is unavailable — copy the ' +
        'values from .env.example into .env.local.',
    );
  }

  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Runs a prompt and parses the JSON response.
 *
 * The prompts instruct the model to return bare JSON, but models occasionally
 * wrap it in a fenced code block, so we tolerate that rather than failing the
 * user's request over formatting.
 */
export async function generateJson<T>(
  prompt: Prompt,
  options: { maxTokens?: number; model?: string } = {},
): Promise<T> {
  const anthropic = getClient();

  let response;
  try {
    response = await anthropic.messages.create({
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: options.maxTokens ?? 2048,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    });
  } catch (cause) {
    throw new AiError('The AI request failed. Please try again.', cause);
  }

  if (response.stop_reason === 'max_tokens') {
    throw new AiError(
      'The AI response was cut off before it finished. Try requesting fewer ' +
        'items at once.',
    );
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  if (!text) {
    throw new AiError('The AI returned an empty response.');
  }

  return parseJson<T>(text);
}

function parseJson<T>(text: string): T {
  // Strip a ```json fence if the model added one.
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(unfenced) as T;
  } catch {
    // Last resort: take the outermost braced span, in case of stray prose.
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1)) as T;
      } catch {
        // fall through
      }
    }
    throw new AiError('The AI returned a response that could not be parsed.');
  }
}

/** True when AI features should be offered in the UI at all. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
