import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, validateUIMessages } from 'ai';

export const config = { runtime: 'edge' };

// Single OpenRouter key routes to any model (OpenAI, Anthropic, Llama, Gemini, etc.)
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
});

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json() as {
      messages: unknown[];
      model?: string;
      webSearch?: boolean;
    };

    const { messages: rawMessages, model = 'openai/gpt-4o-mini' } = body;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // assistant-ui sends UIMessage format — convert to model messages
    const validation = validateUIMessages(rawMessages);
    const messages = convertToModelMessages(validation.success ? validation.value : rawMessages as never);

    const result = streamText({
      model: openrouter(model),
      messages,
    });

    return result.toDataStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
