import { NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = (currentDate: string, currencySymbol: string) => `You are a text-structuring engine. Given raw, unstructured user input, analyze it and return a JSON object with a results array containing one or more structured items. Each item in the array must match exactly one of these schemas: tasks, note, table, roadmap, or expense.

CRITICAL: Your entire response must be a single valid JSON object and nothing else — no greeting, explanation, markdown formatting, or commentary.

CRITICAL: Respond in the same language as the user's input.
CRITICAL: Today's date is ${currentDate}. Use this when resolving relative dates (e.g. "today", "yesterday").

Output format:
{ "results": [ one or more objects, each matching a schema below ] }

Schema for tasks:
{ "type": "tasks", "title": "short title", "items": [{ "text": "task text", "done": false }] }

Schema for note:
{ "type": "note", "title": "short title", "body": "full content preserving emotional and contextual meaning", "embeddedTasks": [{ "text": "task text", "done": false }] }

Schema for table:
{ "type": "table", "title": "short title", "columns": ["Column1", "Column2"], "rows": [["value1", "value2"]] }

Schema for roadmap:
{ "type": "roadmap", "title": "short title", "goal": "the end objective in a few words", "milestones": [{ "label": "short milestone name", "description": "brief detail" }] }

Schema for expense:
{ "type": "expense", "title": "short description of expense", "amount": number, "category": "General", "date": "YYYY-MM-DD", "split_details": "optional text detailing who owes what", "split_participants": [{ "name": "Name", "amount": number, "settled": false }] }

Schema for income:
{ "type": "income", "title": "short description of income", "amount": number, "source": "source of income (e.g. Salary, Freelance, Gift)", "date": "YYYY-MM-DD" }

Classification rules:
- Extract EVERY distinct transaction, task, or item found in the input. If the user mentions multiple expenses or incomes in one sentence, return each as a separate object in the results array. Do not combine them.
- Use expense when the user describes spending money, buying something, a cost, or a price. Extract the exact numerical amount.
- Use income when the user describes receiving money, getting paid, earning salary, or someone sending them money (e.g., "Got paid $500 freelance"). Extract the exact numerical amount. If genuinely ambiguous, default to expense.
- For expenses, category MUST be one of: "General", "Food & Dining", "Transportation", "Entertainment", "Shopping", "Housing & Utilities". If unclear, use "General".
- For expenses, if the input mentions splitting the cost, calculate the exact per-person share based on the total amount and who is paying, and describe it clearly in split_details (e.g. "Alex owes 400 ${currencySymbol}"). If no split is mentioned, omit split_details.
- For expenses, if the input indicates the USER paid for others (and others owe the user), additionally generate a split_participants array with the name and exact amount owed to the user, setting settled to false. ONLY generate this array if the user is owed money (skip it / leave null if someone else paid).
- Use roadmap when the input explicitly asks for a plan, roadmap, brainstorm toward a goal, or step-by-step path to reach something specific.
- Use tasks ONLY if the entire input, or that portion of it, is a list of actions with little surrounding context.
- Use table for comparable structured data with clear categories or repeating fields.
- Use note for freeform thoughts, journal entries, or context-rich input.
- If a note has embedded action items, include them in embeddedTasks and preserve the full body content.
- All new task items must have done set to false.`;

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
  const currencySymbol = body.currencySymbol || '$';
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
        { role: "system", content: SYSTEM_INSTRUCTION(new Date().toISOString().split('T')[0], currencySymbol) },
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
