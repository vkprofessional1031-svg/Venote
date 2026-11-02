export type DemoCategory = 'wallet' | 'job' | 'ask' | 'tasks' | 'note';

export interface ClassifiedDemoResult {
  kind: DemoCategory;
  typeLabel: 'Wallet' | 'Job' | 'Ask' | 'Task' | 'Note';
  statusChip: string;
  headline: string;
  fields: { label: string; value: string }[];
  tasks?: string[];
  rawInput: string;
}

const MAX_INPUT_LEN = 200;

export function sanitizeDemoInput(input: string): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, MAX_INPUT_LEN).trim();
}

export function classifyDemoInput(raw: string): ClassifiedDemoResult {
  const text = sanitizeDemoInput(raw);

  // Empty input falls back to a Note card
  if (!text) {
    return {
      kind: 'note',
      typeLabel: 'Note',
      statusChip: 'Quick Note',
      headline: 'Untitled thought',
      fields: [
        { label: 'Format', value: 'Structured note' },
        { label: 'Preview', value: 'Type anything above or tap an example chip to see how Venote routes it.' },
      ],
      rawInput: 'Untitled thought',
    };
  }

  // 1. Question words or ending with "?" -> Ask answer card
  const isQuestion =
    /\?\s*$/.test(text) ||
    /^(what|how|when|where|who|which|why|did|do|can|could|should|show|list)\b/i.test(text);

  if (isQuestion) {
    const lower = text.toLowerCase();
    let sampleAnswer = 'Found 3 matching entries in your workspace from this week.';
    let sourceLabel = 'Notes · Tasks · Schedule';

    if (/(spend|spent|cost|money|lunch|food|wallet|earn|budget)/i.test(lower)) {
      sampleAnswer = 'You spent $64.50 across 3 Food & Dining transactions this week ($20.00 on lunch today).';
      sourceLabel = 'Wallet · 3 lookups';
    } else if (/(job|interview|oa|application|round|google|deadline)/i.test(lower)) {
      sampleAnswer = 'Google Online Assessment is due this Friday. 2 other applications are in progress.';
      sourceLabel = 'Job Tracker · 2 lookups';
    } else if (/(schedule|tomorrow|today|task|milk|plan)/i.test(lower)) {
      sampleAnswer = 'You have 2 open tasks ("buy milk", "plan launch post") and 1 focus block scheduled.';
      sourceLabel = 'Organize · 2 lookups';
    }

    return {
      kind: 'ask',
      typeLabel: 'Ask',
      statusChip: 'Instant Answer',
      headline: text,
      fields: [
        { label: 'Answer', value: sampleAnswer },
        { label: 'Sources', value: sourceLabel },
      ],
      rawInput: text,
    };
  }

  // 2. Money words or amounts -> Wallet card
  const amountMatch =
    text.match(/\$\s*(\d+(?:\.\d{1,2})?)/) ||
    text.match(/\b(\d+(?:\.\d{1,2})?)\s*(?:dollars?|usd|bucks)\b/i) ||
    text.match(/\b(?:spent|paid|bought|cost|earned|bill|tip)\s+\$?(\d+(?:\.\d{1,2})?)\b/i) ||
    (/\b(spent|paid|bought|cost|expense|earned|income|lunch|dinner|breakfast|coffee|groceries|uber|lyft|rent)\b/i.test(text)
      ? text.match(/\b(\d+(?:\.\d{1,2})?)\b/)
      : null);

  const hasMoneyKeyword =
    /\$\s*\d+|\b(spent|paid|bought|expense|earned|income|lunch|dinner|coffee|groceries|receipt|budget|split)\b/i.test(
      text
    );

  if (amountMatch || hasMoneyKeyword) {
    const numericAmount = amountMatch ? parseFloat(amountMatch[1]) : 20;
    const formattedAmount = `$${numericAmount.toFixed(2)}`;
    const isIncome = /\b(earned|income|salary|refund|paid me)\b/i.test(text);

    let category = isIncome ? 'Income' : 'General';
    if (/\b(lunch|dinner|breakfast|coffee|cafe|food|restaurant|groceries|snack|drink)\b/i.test(text)) {
      category = 'Food & Dining';
    } else if (/\b(uber|lyft|gas|train|bus|flight|parking|transit)\b/i.test(text)) {
      category = 'Transportation';
    } else if (/\b(rent|electric|water|wifi|internet|utility|utilities)\b/i.test(text)) {
      category = 'Housing & Utilities';
    } else if (/\b(movie|concert|game|netflix|spotify)\b/i.test(text)) {
      category = 'Entertainment';
    }

    const cleanedItem =
      text
        .replace(/\b(spent|paid|bought|earned|for|on)\b/gi, '')
        .replace(/\$?\d+(?:\.\d{1,2})?/g, '')
        .replace(/\s+/g, ' ')
        .trim() || (category === 'Food & Dining' ? 'Lunch' : 'Transaction');

    const itemTitle = cleanedItem.charAt(0).toUpperCase() + cleanedItem.slice(1);

    return {
      kind: 'wallet',
      typeLabel: 'Wallet',
      statusChip: isIncome ? 'Income Logged' : 'Saved to Wallet',
      headline: `${formattedAmount} · ${category}`,
      fields: [
        { label: 'Amount', value: `${isIncome ? '+' : '-'}${formattedAmount}` },
        { label: 'Category', value: category },
        { label: 'Merchant / Note', value: itemTitle },
      ],
      rawInput: text,
    };
  }

  // 3. Interview, OA, round, application, deadline words -> Job card
  const hasJobKeyword =
    /\b(interview|oa|online assessment|round|application|applied|deadline|recruiter|onsite|phone screen|offer|leetcode|coding challenge)\b/i.test(
      text
    );

  if (hasJobKeyword) {
    const companyMatch =
      text.match(/\b(Google|Amazon|Meta|Apple|Microsoft|Netflix|Stripe|OpenAI|Anthropic|Vercel|Figma|Linear|Airbnb| Uber)\b/i) ||
      text.match(/^([A-Z][a-zA-Z0-9.&-]{1,20})\b/);
    const company = companyMatch ? companyMatch[1].trim() : 'Tech Co';

    let roundType = 'Interview Round';
    if (/\b(oa|online assessment|coding challenge)\b/i.test(text)) {
      roundType = 'Online Assessment';
    } else if (/\b(phone screen|recruiter)\b/i.test(text)) {
      roundType = 'Recruiter Screen';
    } else if (/\b(onsite|final round)\b/i.test(text)) {
      roundType = 'Final Onsite';
    } else if (/\b(applied|application)\b/i.test(text)) {
      roundType = 'Application Submitted';
    }

    const dateMatch = text.match(
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun|tomorrow|today|next week)\b/i
    );
    const dueLabel = dateMatch ? dateMatch[1] : 'Upcoming';
    const shortDue =
      dueLabel.toLowerCase() === 'friday'
        ? 'Fri'
        : dueLabel.charAt(0).toUpperCase() + dueLabel.slice(1);

    return {
      kind: 'job',
      typeLabel: 'Job',
      statusChip: `Due · ${shortDue}`,
      headline: `${company} · ${roundType} · ${shortDue}`,
      fields: [
        { label: 'Company', value: company },
        { label: 'Stage', value: roundType },
        { label: 'Deadline', value: dueLabel.charAt(0).toUpperCase() + dueLabel.slice(1) },
      ],
      rawInput: text,
    };
  }

  // 4. Task list vs Note fallback
  const hasTaskSignals =
    /,|\band\b|\bthen\b/i.test(text) ||
    /\b(buy|plan|call|email|send|finish|review|schedule|todo|task|remind|pick up|clean|write|ship|prep)\b/i.test(
      text
    );

  if (hasTaskSignals) {
    const parts = text
      .split(/\s*(?:,|;|\band\b|\bthen\b)\s*/i)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);

    const tasks = parts.length > 0 ? parts : [text];
    return {
      kind: 'tasks',
      typeLabel: 'Task',
      statusChip: `${tasks.length} ${tasks.length === 1 ? 'item' : 'items'}`,
      headline: `${tasks.length} ${tasks.length === 1 ? 'action item' : 'items'}`,
      fields: [
        { label: 'Destination', value: 'Organize · Checklist' },
        { label: 'Status', value: 'Ready to check off' },
      ],
      tasks,
      rawInput: text,
    };
  }

  // Fallback: Note card
  return {
    kind: 'note',
    typeLabel: 'Note',
    statusChip: 'Structured Note',
    headline: text.length > 42 ? `${text.slice(0, 42)}…` : text,
    fields: [
      { label: 'Destination', value: 'Organize · Note' },
      { label: 'Captured Text', value: text },
    ],
    rawInput: text,
  };
}

