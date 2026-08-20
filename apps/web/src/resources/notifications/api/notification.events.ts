import { createSessionProofHeaders, getBaseUrl } from '@tabliodb/sdk';

type NotificationEventSubscriber = {
  onChange: () => void;
  onError?: (error: unknown) => void;
};

const notificationChangedEvent = 'notification.changed';
const notificationReconnectDelayMs = 3_000;

export function subscribeNotificationEvents({ onChange, onError }: NotificationEventSubscriber): () => void {
  let closed = false;
  let abortController: AbortController | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = async () => {
    abortController = new AbortController();
    const url = createNotificationStreamUrl();

    try {
      const headers = await createSessionProofHeaders(url, { method: 'GET' });
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          ...headers,
          Accept: 'text/event-stream',
        },
        method: 'GET',
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Notification stream failed with status ${response.status}`);
      }

      await readServerSentEventStream(response.body, (event) => {
        if (event.name === notificationChangedEvent) {
          onChange();
        }
      });

      if (!closed) {
        throw new Error('Notification stream closed');
      }
    } catch (error) {
      if (closed || abortController.signal.aborted) {
        return;
      }

      onError?.(error);
      reconnectTimer = setTimeout(() => void connect(), notificationReconnectDelayMs);
    }
  };

  void connect();

  return () => {
    closed = true;
    abortController?.abort();

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
  };
}

async function readServerSentEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: { data: string; name: string }) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Nest SSE emits standard text/event-stream frames; normalizing CRLF keeps parsing stable across proxies.
      buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n');
      let separatorIndex = buffer.indexOf('\n\n');

      while (separatorIndex >= 0) {
        const rawEvent = buffer.slice(0, separatorIndex);

        buffer = buffer.slice(separatorIndex + 2);
        separatorIndex = buffer.indexOf('\n\n');

        const parsedEvent = parseServerSentEvent(rawEvent);

        if (parsedEvent) {
          onEvent(parsedEvent);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseServerSentEvent(rawEvent: string): { data: string; name: string } | null {
  const lines = rawEvent.split('\n');
  const eventName =
    lines
      .find((line) => line.startsWith('event:'))
      ?.slice('event:'.length)
      .trim() ?? 'message';
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart());

  if (dataLines.length === 0) {
    return null;
  }

  return {
    data: dataLines.join('\n'),
    name: eventName,
  };
}

function createNotificationStreamUrl(): string {
  const baseUrl = getBaseUrl().replace(/\/$/, '');

  if (baseUrl.startsWith('/')) {
    return `${baseUrl}/notifications/stream`;
  }

  return new URL(`${baseUrl}/notifications/stream`).toString();
}
