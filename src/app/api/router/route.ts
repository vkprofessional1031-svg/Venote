import { NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `You are a smart domain routing engine. Given raw user input, classify it strictly into one of three domains: 'organize', 'wallet', or 'prep'.

Routing Rules:
- 'wallet': For personal financial transactions where the user is logging what they spent, bought, paid, earned, or received (e.g. "Spent $20 on lunch", "Coffee $4.50", "Uber home $24", "Got paid $500 freelance", "Paid $120 for groceries split with Sam").
- 'prep': For job search, interview preparation, applications, recruiter screenings, online assessments (OAs), rounds, mock interviews, or LeetCode practice (e.g. "Applied to Netflix for backend role", "Google OA due Friday", "Did 3 LeetCode problems", "Rejected by Stripe", "Amazon onsite on Monday").
- 'organize': For general notes, tasks, todo lists, brainstorming, roadmaps, AND comparison tables / structured data.
  * CRITICAL: Multiple distinct entities each with a price/attribute described comparatively (e.g. "Riverside apartment is $1800, Oakwood is $2100, Maple is $1600", "MacBook Air is $1000, Pro is $2000", "Option A vs Option B") MUST route to 'organize' (as a comparison table), NOT 'wallet'.
  * Simple checklists, reminders, or general thoughts (e.g. "todo: buy milk", "ideas for novel", "plan for vacation") MUST route to 'organize'.

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
      model: "qwen/qwen3.6-27b",
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
