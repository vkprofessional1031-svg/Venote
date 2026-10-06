import { StreamEvent } from './groqStream';

type Handlers = {
  onDelta?: (text: string) => void;
  onClear?: () => void;
  onStatus?: (text: string) => void;
  onSources?: (sources: any[]) => void;
  onToolCalls?: (toolCalls: any[]) => void;
  onDone?: (finishReason: string | null) => void;
  onError?: (message: string) => void;
};

export async function readNdjson(response: Response, handlers: Handlers, signal?: AbortSignal) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        break;
      }
      
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event: StreamEvent = JSON.parse(line);
          switch (event.type) {
            case 'delta':
              handlers.onDelta?.(event.text);
              break;
            case 'clear':
              handlers.onClear?.();
              break;
            case 'status':
              handlers.onStatus?.(event.text);
              break;
            case 'sources':
              handlers.onSources?.(event.sources);
              break;
            case 'tool_calls':
              handlers.onToolCalls?.(event.toolCalls);
              break;
            case 'done':
              handlers.onDone?.(event.finishReason);
              break;
            case 'error':
              handlers.onError?.(event.message);
              break;
          }
        } catch (e) {
          console.error("Failed to parse ndjson line", line, e);
        }
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || signal?.aborted) {
      // Aborted quietly
      return;
    }
    handlers.onError?.(error.message || 'Stream reading failed');
  } finally {
    reader.releaseLock();
  }
}
