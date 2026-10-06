export type StreamEvent = 
  | { type: 'delta'; text: string }
  | { type: 'status'; text: string }
  | { type: 'sources'; sources: any[] }
  | { type: 'done'; finishReason: string | null }
  | { type: 'error'; message: string }
  | { type: 'tool_calls'; toolCalls: any[] }
  | { type: 'clear' };

export async function* groqStream(responseBody: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = responseBody.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  let inThink = false;
  let possibleThinkStart = '';
  let possibleThinkEnd = '';
  let toolCalls: any[] = [];

  const processText = (text: string): string => {
    let result = '';
    let i = 0;
    while (i < text.length) {
      if (!inThink) {
        // Look for <think>
        const remaining = text.substring(i);
        if (remaining.startsWith('<think>')) {
          inThink = true;
          i += 7;
          continue;
        } else if ('<think>'.startsWith(remaining)) {
          // Could be the start of <think> but chunk ended
          possibleThinkStart = remaining;
          break;
        } else {
          result += text[i];
          i++;
        }
      } else {
        // Look for </think>
        const remaining = text.substring(i);
        if (remaining.startsWith('</think>')) {
          inThink = false;
          i += 8;
          continue;
        } else if ('</think>'.startsWith(remaining)) {
          // Could be the end of </think> but chunk ended
          possibleThinkEnd = remaining;
          break;
        } else {
          // Inside <think>, ignore character
          i++;
        }
      }
    }
    return result;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        const dataStr = line.replace(/^data: /, '').trim();
        
        if (dataStr === '[DONE]') {
          continue;
        }

        try {
          const data = JSON.parse(dataStr);
          const choice = data.choices?.[0];
          let delta = choice?.delta?.content || '';
          
          if (possibleThinkStart) {
            delta = possibleThinkStart + delta;
            possibleThinkStart = '';
          }
          if (possibleThinkEnd) {
            delta = possibleThinkEnd + delta;
            possibleThinkEnd = '';
          }

          const processed = processText(delta);
          if (processed) {
            yield { type: 'delta', text: processed };
          }

          if (choice?.delta?.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { 
                  id: tc.id || '', 
                  type: 'function',
                  function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' } 
                };
              } else {
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }

          if (choice?.finish_reason) {
            yield { type: 'done', finishReason: choice.finish_reason };
          }
        } catch (e) {
          console.error("Error parsing stream chunk", e);
        }
      }
    }
    
    // Flush possible pending parts
    if (possibleThinkStart) {
      yield { type: 'delta', text: possibleThinkStart };
    }

    if (toolCalls.length > 0) {
      yield { type: 'tool_calls', toolCalls: toolCalls.filter(Boolean) };
    }
  } finally {
    reader.releaseLock();
  }
}
