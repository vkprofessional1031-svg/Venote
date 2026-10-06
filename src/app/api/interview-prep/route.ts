import { NextResponse } from 'next/server';
import { groqStream } from '@/lib/groqStream';

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GROQ_API_KEY environment variable is missing.' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid JSON body in request.' },
      { status: 400 }
    );
  }

  const { jobApplicationId, mode, company, role, notes, messages } = body;

  if (!mode || !company || !role || !messages || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: 'Missing required fields: mode, company, role, or messages.' },
      { status: 400 }
    );
  }

  let systemInstruction = '';
  const formattingInstruction = "Format your response for a mobile-friendly chat interface — prefer short paragraphs and bulleted lists over wide tables. Only use a markdown table if the content is genuinely tabular (like a comparison), and keep it to 2-3 columns max so it doesn't overflow on a phone screen. Break long plans into clearly-labeled sections with headings rather than one dense block.";

  if (mode === 'research') {
    systemInstruction = `You are an interview prep assistant helping the user prepare for a ${role} interview at ${company}. Provide likely interview questions, company research points, and topics to review. Be specific to this company/role when possible, general best-practice when not.\n\n${formattingInstruction}`;
  } else if (mode === 'mock') {
    systemInstruction = `You are conducting a mock interview for a ${role} position at ${company}. Ask one interview question at a time, wait for the user's answer, then give brief constructive feedback before asking the next question. Keep the interview realistic and role-appropriate.\n\n${formattingInstruction}`;
  } else {
    return NextResponse.json(
      { error: 'Invalid mode. Must be "research" or "mock".' },
      { status: 400 }
    );
  }

  if (notes) {
    systemInstruction += `\n\nAdditional user notes for context:\n${notes}`;
  }

  try {
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const payload = {
      model: "qwen/qwen3.8-27b",
      reasoning_format: "hidden",
      reasoning_effort: "none",
      max_tokens: 8192,
      stream: true,
      messages: [
        { role: "system", content: systemInstruction },
        ...messages
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: request.signal,
    });

    if (!response.ok) {
      let errorMsg = 'Failed to fetch from Groq API';
      try {
         const data = await response.json();
         errorMsg = data.error?.message || errorMsg;
      } catch (e) {}
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status }
      );
    }

    if (!response.body) {
      return NextResponse.json({ error: 'No response body' }, { status: 500 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of groqStream(response.body!)) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
          }
        } catch (error: any) {
          if (error.name !== 'AbortError') {
             controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'error', message: error.message || 'Stream error' }) + '\n'));
          }
        } finally {
          try { controller.close(); } catch (e) {}
        }
      },
      cancel() {
        // Handled by signal propagation implicitly
      }
    });

    return new NextResponse(stream, {
      status: 200,
      headers: { 
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform'
      },
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return new NextResponse(null, { status: 499 });
    }
    console.error('Groq API Error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
