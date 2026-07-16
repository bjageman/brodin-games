import { useEffect, useRef, useState, useCallback } from 'react';
import { DEBUG_MODE } from '../constants';

// Read endpoints and credentials from environment variables.
// Leave USERNAME/PASSWORD blank when using the public ntfy.sh broker.
const NTFY_SERVER_URL = import.meta.env.VITE_NTFY_SERVER_URL || 'ntfy.sh';
const NTFY_USERNAME = import.meta.env.VITE_NTFY_ADMIN_USERNAME || '';
const NTFY_PASSWORD = import.meta.env.VITE_NTFY_ADMIN_PASSWORD || '';

/**
 * Build the auth= query parameter value for ntfy.
 *
 * ntfy expects the auth= value to be the *base64url-encoded* form of the
 * entire Authorization header value (e.g. base64url("Basic <base64(u:p)>")).
 * Standard URL-encoding ("Basic%20...") is NOT accepted and returns a 500.
 * Using auth= for both the WebSocket URL and the POST URL avoids sending an
 * Authorization header, which would otherwise trigger a CORS preflight that
 * ntfy cannot satisfy when Access-Control-Allow-Origin is set to '*'.
 */
function buildAuthValue(): string {
  if (!NTFY_USERNAME || !NTFY_PASSWORD) return '';
  const headerValue = `Basic ${btoa(`${NTFY_USERNAME}:${NTFY_PASSWORD}`)}`;
  // base64url-encode the full header value (no padding, url-safe chars)
  return btoa(headerValue)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// sinceId lets a reconnect ask ntfy to replay anything published while the
// WebSocket was down (ntfy caches recent messages per topic) instead of
// silently losing it — a real gap otherwise, since ws.onclose reconnects
// after a fixed 3s delay with no memory of where the stream left off.
function buildQueryParams(sinceId: string | null): string {
  const params: string[] = [];
  const auth = buildAuthValue();
  if (auth) params.push(`auth=${auth}`);
  if (sinceId) params.push(`since=${sinceId}`);
  return params.length > 0 ? `?${params.join('&')}` : '';
}

/**
 * Helper to determine the domain and protocols (ws/wss, http/https) based on NTFY_SERVER_URL.
 */
function resolveNtfyEndpoints(serverUrl: string): { domain: string; wsProtocol: string; httpProtocol: string } {
  // Strip protocol prefix if provided in env
  const domain = serverUrl.replace(/^(https?:\/\/|wss?:\/\/)/, '');
  
  let wsProtocol: string;
  let httpProtocol: string;

  if (serverUrl.startsWith('http://') || serverUrl.startsWith('ws://')) {
    wsProtocol = 'ws';
    httpProtocol = 'http';
  } else if (serverUrl.startsWith('https://') || serverUrl.startsWith('wss://')) {
    wsProtocol = 'wss';
    httpProtocol = 'https';
  } else {
    // Detect based on domain pattern for local addresses
    const isLocal =
      domain.startsWith('localhost') ||
      domain.startsWith('127.0.0.1') ||
      domain.startsWith('192.168.') ||
      domain.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(domain) ||
      domain.endsWith('.local') ||
      domain.includes('.local:');
      
    wsProtocol = isLocal ? 'ws' : 'wss';
    httpProtocol = isLocal ? 'http' : 'https';
  }

  return { domain, wsProtocol, httpProtocol };
}

export function useGameSocket(gameCode: string, onMessage: (data: unknown) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef(onMessage);

  // Keep callback ref updated to prevent re-subscribing on every callback change
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!gameCode) return;
    const topic = `brodin-games-${gameCode.toLowerCase()}`;
    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let lastMessageId: string | null = null;

    function connect() {
      const { domain, wsProtocol } = resolveNtfyEndpoints(NTFY_SERVER_URL);

      const wsUrl = `${wsProtocol}://${domain}/${topic}/ws${buildQueryParams(lastMessageId)}`;
      console.log(`[ntfy] Connecting to: ${wsProtocol}://${domain}/${topic}/ws${lastMessageId ? ` (since=${lastMessageId})` : ''}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) {
          console.log(`[ntfy] Connection opened successfully for topic: ${topic}`);
          setIsConnected(true);
        }
      };

      ws.onmessage = (event) => {
        try {
          const eventData = JSON.parse(event.data);
          if (eventData.id) lastMessageId = eventData.id;
          if (eventData.message) {
            const payload = JSON.parse(eventData.message) as unknown;
            // Full-payload logging on every message is a real drag with devtools
            // open (the whole GameState ships on each action), so gate it.
            if (DEBUG_MODE) console.log(`[ntfy] Message received on topic ${topic}:`, payload);
            onMessageRef.current(payload);
          }
        } catch (e) {
          console.warn(`[ntfy] Non-JSON or unparseable event on topic ${topic}:`, event.data, e);
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          console.warn(`[ntfy] Connection closed for topic ${topic}. Attempting reconnection in 3s...`);
          setIsConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error(`[ntfy] Error on topic ${topic}:`, error);
        ws.close();
      };
    }

    connect();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        console.log(`[ntfy] Cleaning up connection for topic: ${topic}`);
        wsRef.current.close();
      }
    };
  }, [gameCode]);

  const sendMessage = useCallback(async (payload: unknown) => {
    if (!gameCode) return;
    const topic = `brodin-games-${gameCode.toLowerCase()}`;
    const { domain, httpProtocol } = resolveNtfyEndpoints(NTFY_SERVER_URL);
    // Use ?auth= query param instead of Authorization header to avoid CORS preflight.
    const publishUrl = `${httpProtocol}://${domain}/${topic}${buildQueryParams(null)}`;

    if (DEBUG_MODE) console.log(`[ntfy] Publishing message to: ${httpProtocol}://${domain}/${topic}`, payload);
    try {
      const response = await fetch(publishUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.error(`[ntfy] HTTP POST publish failed with status: ${response.status} ${response.statusText}`);
      }
    } catch (e) {
      console.error(`[ntfy] Exception during HTTP POST publish:`, e);
    }
  }, [gameCode]);

  return { isConnected, sendMessage };
}
