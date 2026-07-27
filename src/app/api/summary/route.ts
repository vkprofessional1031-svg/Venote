import { NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `You are a helpful, friendly financial assistant. Given a user's spending data for the current month, write a short list of 3-4 sharp, scannable bullet points summarizing their spending.
Follow this exact structure:
1. Total spent this month.
2. Top spending category (with amount).
3. Budget status (e.g. "Within budget on all tracked categories" or "Over budget on X by Y").
4. One notable pattern or observation (ONLY if something stands out, otherwise omit this bullet).

CRITICAL: Do not write paragraphs or filler text. Each bullet must be one clear fact or insight.
CRITICAL: You MUST return a single valid JSON object containing a "bullets" array of strings. Do not return markdown, just JSON.

Output format:
{ "bullets": ["Total spent: $255 this month", "Top category: Food ($100)", "Within budget on all tracked categories"] }`;

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

  const { totalSpent, categoryTotals, budgets, currencySymbol = '$' } = body;

  if (totalSpent === undefined || !categoryTotals) {
    return NextResponse.json(
      { error: 'totalSpent and categoryTotals are required in the JSON body.' },
      { status: 400 }
    );
  }

  let userText = `Here is my spending data for this month:\n`;
  userText += `Total Spent: ${currencySymbol}${Number(totalSpent).toFixed(2)}\n\n`;
  
  userText += `Category Totals:\n`;
  Object.entries(categoryTotals).forEach(([cat, amt]) => {
    userText += `- ${cat}: ${currencySymbol}${Number(amt).toFixed(2)}\n`;
  });

  userText += `\nBudgets set:\n`;
  if (budgets && Object.keys(budgets).length > 0) {
    Object.entries(budgets).forEach(([cat, limit]) => {
      userText += `- ${cat}: ${currencySymbol}${Number(limit).toFixed(2)} limit\n`;
    });
  } else {
    userText += `No budgets set.\n`;
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
        return NextResponse.json(
          { error: 'rate_limit', message: "You've hit the AI service's usage limit for now. Please wait a minute and try again.", details: data },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Groq API call failed', details: data },
        { status: response.status }
      );
    }

    const groqText = data.choices?.[0]?.message?.content;
    
    if (!groqText) {
      return NextResponse.json(
        { error: 'Unexpected response format from Groq API', details: data },
        { status: 500 }
      );
    }

    let parsedData;
    try {
      parsedData = JSON.parse(groqText);
    } catch (e) {
      let cleanedText = groqText.trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
      try {
        parsedData = JSON.parse(cleanedText);
      } catch (e2) {
        parsedData = { bullets: [groqText] };
      }
    }

    const finalString = JSON.stringify(parsedData.bullets || []);
    return NextResponse.json({ summary: finalString });
  } catch (error: any) {
    console.error('Error calling Groq API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the request.', details: error.message },
      { status: 500 }
    );
  }
}
