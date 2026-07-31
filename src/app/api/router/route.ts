import { NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `You are a domain routing engine. Given raw user input, classify it strictly into one of three domains: 'organize', 'wallet', or 'prep'.
- 'wallet': If the input involves money, expenses, income, spending, buying, getting paid, or costs.
- 'prep': If the input involves job applications, interviews, online assessments (OAs), recruiter calls, mock interviews, or leetcode practice.
- 'organize': If the input is a general task, note, roadmap, brainstorm, or list that doesn't fit the other two.

CRITICAL: Return a single JSON object with a "domain" string key. Do not output anything else.`;

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY environment variable is missing.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const userText = body.text;
  if (!userText || typeof userText !== 'string') {
    return NextResponse.json({ error: 'A "text" field is required.' }, { status: 400 });
  }

  try {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: userText }
      ],
      response_format: { type: "json_object" }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
      }
      return NextResponse.json({ error: 'Groq API call failed' }, { status: response.status });
    }

    const groqText = data.choices?.[0]?.message?.content;
    let parsedData = { domain: 'organize' };
    
    if (groqText) {
      try {
        parsedData = JSON.parse(groqText);
      } catch (e) {
        let cleanedText = groqText.trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
        try {
          parsedData = JSON.parse(cleanedText);
        } catch (e2) {}
      }
    }

    if (!['organize', 'wallet', 'prep'].includes(parsedData.domain)) {
      parsedData.domain = 'organize';
    }

    return NextResponse.json({ domain: parsedData.domain });
  } catch (error: any) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
