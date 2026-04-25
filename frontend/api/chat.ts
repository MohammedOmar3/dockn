import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, validateUIMessages } from 'ai';

export const config = { runtime: 'edge' };

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

    const { messages: rawMessages, model = 'gpt-4o-mini' } = body;

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // assistant-ui sends UIMessage format — convert to model messages
    const validation = validateUIMessages(rawMessages);
    const messages = convertToModelMessages(validation.success ? validation.value : rawMessages as never);

    const isAnthropic = String(model).startsWith('claude');

    const result = streamText({
      model: isAnthropic ? anthropic(model) : openai(model),
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
