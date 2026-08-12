import { NextResponse } from 'next/server';

const ORGANIZE_SYSTEM_INSTRUCTION = (currentDate: string) => `You are a text-structuring engine for an Organization workspace. Given raw, unstructured user input, analyze it and return a JSON object with a "results" array containing one or more structured items.
Each item in the array MUST match exactly one of these schemas: "tasks", "note", "table", or "roadmap".
DO NOT output "expense" or "income".

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

Classification rules:
- Even short phrases like "todo: buy milk" or "buy milk and eggs" must be formatted as "tasks" schema with done set to false.
- Use tasks if the input is a todo list, reminder, action item, or checklist.
- Use table for comparable structured data with clear categories, multi-item comparisons, or repeating fields (e.g., comparing apartment prices, products, features).
- Use roadmap when the input explicitly asks for a plan, roadmap, brainstorm toward a goal, or step-by-step path.
- Use note for freeform thoughts, journal entries, context-rich input, or general text.
- If a note has embedded action items, include them in embeddedTasks and preserve the full body content.
- All new task items must have done set to false.`;

const WALLET_SYSTEM_INSTRUCTION = (currentDate: string, currencySymbol: string) => `You are a financial text-structuring engine for a Wallet tracker. Given raw user input, analyze it and return a JSON object with a "results" array containing one or more structured financial items.
Each item in the array MUST match either the "expense" schema or the "income" schema.

CRITICAL: Your entire response must be a single valid JSON object and nothing else.
CRITICAL: Respond in the same language as the user's input.
CRITICAL: Today's date is ${currentDate}. Use this when resolving relative dates.

Output format:
{ "results": [ one or more objects, each matching a schema below ] }

Schema for expense:
{ "type": "expense", "title": "short description of expense", "amount": number, "category": "General", "date": "YYYY-MM-DD", "split_details": "optional text detailing who owes what", "split_participants": [{ "name": "Name", "amount": number, "settled": false }] }

Schema for income:
{ "type": "income", "title": "short description of income", "amount": number, "source": "source of income (e.g. Salary, Freelance, Gift)", "date": "YYYY-MM-DD" }

Classification rules:
- Extract EVERY distinct transaction found in the input. If the user mentions multiple transactions in one sentence, return each as a separate object.
- Use expense when the user describes spending money, buying something, a cost, or a price. Extract the exact numerical amount.
- Use income when the user describes receiving money, getting paid, earning salary, or someone sending them money.
- For expenses, category MUST be one of: "General", "Food & Dining", "Transportation", "Entertainment", "Shopping", "Housing & Utilities". If unclear, use "General".
- For expenses, if splitting the cost is mentioned, calculate the exact per-person share and describe it in split_details.
- For expenses, if the user paid for others, generate a split_participants array with name, amount, settled: false.`;

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
  const domain = body.domain || 'organize';
  const currencySymbol = body.currencySymbol || '$';

  if (!userText || typeof userText !== 'string') {
    return NextResponse.json(
      { error: 'A "text" field is required in the JSON body.' },
      { status: 400 }
    );
  }

  try {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const systemPrompt = domain === 'wallet'
      ? WALLET_SYSTEM_INSTRUCTION(new Date().toISOString().split('T')[0], currencySymbol)
      : ORGANIZE_SYSTEM_INSTRUCTION(new Date().toISOString().split('T')[0]);

    const payload = {
      model: "qwen/qwen3.6-27b",
      messages: [
        { role: "system", content: systemPrompt },
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

    let parsedData: any;
    try {
      parsedData = JSON.parse(groqText);
    } catch (parseError) {
      let cleanedText = groqText.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```[a-zA-Z]*\n?/, '');
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

    // Normalization logic
    let rawResults: any[] = [];
    if (parsedData.results && Array.isArray(parsedData.results)) {
      rawResults = parsedData.results;
    } else if (Array.isArray(parsedData)) {
      rawResults = parsedData;
    } else if (parsedData.type) {
      rawResults = [parsedData];
    } else if (parsedData.items && Array.isArray(parsedData.items)) {
      rawResults = [{ type: 'tasks', title: parsedData.title || 'Tasks', items: parsedData.items }];
    } else if (parsedData.task || parsedData.todo) {
      const taskText = parsedData.task || parsedData.todo;
      rawResults = [{ type: 'tasks', title: 'Tasks', items: [{ text: typeof taskText === 'string' ? taskText : JSON.stringify(taskText), done: false }] }];
    } else {
      rawResults = [parsedData];
    }

    // Sanitize and ensure type compatibility
    const normalizedResults = rawResults.map((item: any) => {
      if (domain === 'organize') {
        if (item.type === 'expense' || item.type === 'income') {
          return {
            type: 'note',
            title: item.title || 'Note',
            body: `${item.title || 'Transaction'}: ${currencySymbol}${item.amount || 0} (${item.category || item.source || 'General'})`,
            embeddedTasks: []
          };
        }
        if (!item.type) {
          if (item.items && Array.isArray(item.items)) return { ...item, type: 'tasks', title: item.title || 'Tasks' };
          if (item.columns && item.rows) return { ...item, type: 'table', title: item.title || 'Table' };
          if (item.milestones || item.goal) return { ...item, type: 'roadmap', title: item.title || 'Roadmap' };
          return { ...item, type: 'note', title: item.title || 'Note', body: item.body || userText, embeddedTasks: [] };
        }
      }
      return item;
    });

    return NextResponse.json({ results: normalizedResults });
  } catch (error: any) {
    console.error('Error calling Groq API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the request.', details: error.message },
      { status: 500 }
    );
  }
}
