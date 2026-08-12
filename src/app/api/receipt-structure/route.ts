import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an AI assistant that extracts data from receipt images for an expense tracker. 
Analyze the provided image and return a JSON object with exactly these fields:
- "amount": a number representing the total amount paid. Do not include currency symbols.
- "merchant": a string representing the name of the store, merchant, or service provider.
- "date": a string in "YYYY-MM-DD" format. If unclear, use the best guess from the receipt.
- "category": a string. MUST be one of: "General", "Food & Dining", "Transportation", "Entertainment", "Shopping", "Housing & Utilities". Choose the most appropriate based on the merchant/items.
- "currency": a string with the currency symbol (e.g. "$", "€", "£") or code (e.g. "USD", "EUR") found on the receipt. If not found, return null.

CRITICAL: Your entire response must be a single valid JSON object and nothing else — no explanation, no markdown code blocks, just the JSON.`;

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

  const { imageUrl } = body;

  if (!imageUrl || typeof imageUrl !== 'string') {
    return NextResponse.json(
      { error: 'An "imageUrl" field is required in the JSON body.' },
      { status: 400 }
    );
  }

  try {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    
    // We use the Meta vision model supported by Groq
    const payload = {
      model: "qwen/qwen3.6-27b",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SYSTEM_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
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
      console.error('Groq API error response:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });
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

    return NextResponse.json({ result: parsedData });
  } catch (error: any) {
    console.error('Error calling Groq Vision API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing the request.', details: error.message },
      { status: 500 }
    );
  }
}
