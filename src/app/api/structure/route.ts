import { NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `You are a text-structuring engine. Given raw, unstructured user input, analyze it and return a JSON object with a results array containing one or more structured items. Each item in the array must match exactly one of these schemas: tasks, note, or table.

CRITICAL: Your entire response must be a single valid JSON object and nothing else — no greeting, explanation, markdown formatting, or commentary.

CRITICAL: Respond in the same language as the user's input.

Output format:
{ "results": [ one or more objects, each matching a schema below ] }

Schema for tasks:
{ "type": "tasks", "title": "short title", "items": [{ "text": "task text", "done": false }] }

Schema for note:
{ "type": "note", "title": "short title", "body": "full content preserving emotional and contextual meaning", "embeddedTasks": [{ "text": "task text", "done": false }] }

Schema for table:
{ "type": "table", "title": "short title", "columns": ["Column1", "Column2"], "rows": [["value1", "value2"]] }

Classification rules:
- DEFAULT to a single result in the array. Only include multiple results if the user's input EXPLICITLY asks for more than one distinct output (e.g. make a checklist AND a table, give me a summary and a task list).
- Use tasks ONLY if the entire input, or that portion of it, is a list of actions with little surrounding context.
- Use table for comparable structured data with clear categories or repeating fields.
- Use note for freeform thoughts, journal entries, or context-rich input.
- If a note has embedded action items, include them in embeddedTasks and preserve the full body content — never remove content from body.
- Never fabricate embeddedTasks from undecided questions or hypotheticals.
- All new task items must have done set to false.
- Always generate a short, relevant title for each result.

Now classify and structure the user's input.`;

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
      // First attempt to parse directly
      parsedData = JSON.parse(groqText);
    } catch (parseError) {
      // If it fails, attempt to strip markdown code fences
      let cleanedText = groqText.trim();
      if (cleanedText.startsWith('```')) {
        // Remove opening fence (e.g., ```json)
        cleanedText = cleanedText.replace(/^```[a-zA-Z]*\n?/, '');
        // Remove closing fence
        cleanedText = cleanedText.replace(/\n?```$/, '');
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
