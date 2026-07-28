import { NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = (currentDate: string) => `You are a text-structuring engine for a job application Rounds Tracker. Given raw, unstructured user input, analyze it and return a JSON object with a results array containing one or more structured items. Each item must match either the "round" schema or the "prep" schema.

CRITICAL: Your entire response must be a single valid JSON object and nothing else — no greeting, explanation, markdown formatting, or commentary.
CRITICAL: Respond in the same language as the user's input.
CRITICAL: Today's date is ${currentDate}. Use this to resolve relative dates (e.g., "today", "tomorrow", "Friday").

Output format:
{ "results": [ one or more objects, each matching a schema below ] }

Schema for round:
{ 
  "type": "round", 
  "company": "Company Name", 
  "role": "Role Name (default to 'Software Engineer' if omitted)", 
  "round_name": "Name of the interview round (e.g. 'OA', 'Phone Screen')", 
  "deadline": "YYYY-MM-DDTHH:mm:ss (if time mentioned, DO NOT include 'Z'), otherwise YYYY-MM-DD", 
  "notes": "Any additional context (do not include the raw time/date string. Do not duplicate the role name or company name in the notes field. Only include notes if there is genuinely new context not already captured in company, role, round_name, or deadline. If there's nothing extra to add, leave notes empty.)" 
}

Schema for prep:
{ 
  "type": "prep", 
  "prep_type": "Type of prep (e.g. 'LeetCode', 'Mock Interview', 'System Design')", 
  "count_or_duration": "E.g. '3 problems' or '45 mins'", 
  "company_reference": "Company name if they mention prepping for a specific application, else null" 
}

Classification rules:
- DEFAULT to a single result in the array, unless explicitly given multiple distinct actions.
- Use "round" when the user mentions an interview, assessment, offer, or any stage of a job application process. Extract the company and round name carefully. Resolve deadlines/dates.
- Use "prep" when the user mentions practicing, studying, doing LeetCode, mock interviews, or preparing. If they mention prepping FOR a specific company, include it in company_reference.`;

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

  const userText = body.text;
  if (!userText || typeof userText !== 'string') {
    return NextResponse.json(
      { error: 'A "text" field is required in the JSON body.' },
      { status: 400 }
    );
  }

  try {
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION(new Date().toISOString().split('T')[0]) },
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
    } catch (parseError) {
      let cleanedText = groqText.trim();
      if (cleanedText.startsWith('\`\`\`')) {
        cleanedText = cleanedText.replace(/^\`\`\`[a-zA-Z]*\n?/, '');
        cleanedText = cleanedText.replace(/\n?\`\`\`$/, '');
      }
      
      try {
        parsedData = JSON.parse(cleanedText);
      } catch (secondParseError: any) {
        return NextResponse.json(
          { 
            error: 'Failed to parse Groq response as JSON.', 
            rawText: groqText, 
            parseError: secondParseError.message 
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error calling Groq API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the request.', details: error.message },
      { status: 500 }
    );
  }
}
