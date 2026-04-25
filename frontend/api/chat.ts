import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json() as {
      messages: Array<{ role: string; content: string }>;
      model?: string;
    };

    const { messages, model = 'gpt-4o-mini' } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isAnthropic = String(model).startsWith('claude');

    const result = streamText({
      model: isAnthropic ? anthropic(model) : openai(model),
      messages,
    });

    return result.toDataStreamResponse();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
