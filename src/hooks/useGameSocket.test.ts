import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameSocket } from './useGameSocket';

interface MockWebSocket {
  url: string;
  close: () => void;
  send: (data: string) => void;
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: (error: unknown) => void;
}

describe('useGameSocket', () => {
  let originalWebSocket: typeof WebSocket;
  let originalFetch: typeof fetch;
  let mockWsInstances: MockWebSocket[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    originalWebSocket = globalThis.WebSocket;
    originalFetch = globalThis.fetch;
    mockWsInstances = [];

    // Mock WebSocket
    globalThis.WebSocket = vi.fn().mockImplementation(function (this: MockWebSocket, url: string) {
      this.url = url;
      this.close = vi.fn().mockImplementation(() => {
        if (this.onclose) this.onclose();
      });
      this.send = vi.fn();
      mockWsInstances.push(this);
      return this;
    }) as unknown as typeof WebSocket;

    // Mock fetch
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response)
    );
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('should establish websocket connection with correct url', () => {
    renderHook(() => useGameSocket('ABCDE', () => {}));

    expect(globalThis.WebSocket).toHaveBeenCalledTimes(1);
    // URL must contain the correct topic path and /ws suffix
    expect(mockWsInstances[0].url).toContain('/brodin-games-abcde/ws');
    // Must use secure websocket protocol (wss:// for non-localhost)
    expect(mockWsInstances[0].url).toMatch(/^wss:\/\//)
  });

  it('should set isConnected to true on open and false on close', () => {
    const { result } = renderHook(() => useGameSocket('ABCDE', () => {}));

    expect(result.current.isConnected).toBe(false);

    act(() => {
      mockWsInstances[0].onopen?.();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      mockWsInstances[0].onclose?.();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('should parse incoming messages and call onMessage callback', () => {
    const onMessageMock = vi.fn();
    renderHook(() => useGameSocket('ABCDE', onMessageMock));

    act(() => {
      mockWsInstances[0].onmessage?.({
        data: JSON.stringify({
          message: JSON.stringify({ type: 'TEST', value: 123 }),
        }),
      });
    });

    expect(onMessageMock).toHaveBeenCalledWith({ type: 'TEST', value: 123 });
  });

  it('should handle unparseable or non-JSON messages gracefully', () => {
    const onMessageMock = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderHook(() => useGameSocket('ABCDE', onMessageMock));

    act(() => {
      mockWsInstances[0].onmessage?.({ data: 'invalid json' });
    });

    expect(onMessageMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('should reconnect on close after 3 seconds', () => {
    renderHook(() => useGameSocket('ABCDE', () => {}));

    expect(globalThis.WebSocket).toHaveBeenCalledTimes(1);

    act(() => {
      mockWsInstances[0].onclose?.();
    });

    expect(globalThis.WebSocket).toHaveBeenCalledTimes(1);

    // Fast-forward 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(globalThis.WebSocket).toHaveBeenCalledTimes(2);
    expect(mockWsInstances[1].url).toContain('/brodin-games-abcde/ws');
  });

  it('should cleanup connection on unmount', () => {
    const { unmount } = renderHook(() => useGameSocket('ABCDE', () => {}));

    const closeSpy = vi.spyOn(mockWsInstances[0], 'close');
    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('should publish via fetch POST with ?auth= query param and no Authorization header', async () => {
    const { result } = renderHook(() => useGameSocket('ABCDE', () => {}));

    await act(async () => {
      await result.current.sendMessage({ action: 'reveal' });
    });

    const [calledUrl, calledOptions] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as
      [string, RequestInit];

    // URL must contain the correct topic path
    expect(calledUrl).toContain('/brodin-games-abcde');
    // Must use https (not http) for non-localhost servers
    expect(calledUrl).toMatch(/^https:\/\//);

    // No Authorization header should be present — auth goes in the ?auth= query param
    const headers = calledOptions.headers as Record<string, string> | undefined;
    expect(headers?.['Authorization']).toBeUndefined();

    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.body).toBe(JSON.stringify({ action: 'reveal' }));
  });
});
