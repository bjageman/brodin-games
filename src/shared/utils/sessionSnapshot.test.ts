import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearGameSession,
  gameSnapshotKey,
  HOST_ROUTE_KEY,
  JOIN_ROUTE_KEY,
} from './sessionSnapshot';

describe('clearGameSession', () => {
  beforeEach(() => sessionStorage.clear());

  it('wipes every snapshot scoped to the room code, including bespoke game keys', () => {
    const code = 'WXYZ';
    sessionStorage.setItem(gameSnapshotKey(code), '{"shell":1}');
    sessionStorage.setItem(`fake-it-snap-${code}`, '{"lines":[]}');
    sessionStorage.setItem(`joke-factory-snap-${code}`, '{"jokes":[]}');
    sessionStorage.setItem(HOST_ROUTE_KEY, '{"code":"WXYZ"}');
    sessionStorage.setItem(JOIN_ROUTE_KEY, '{"code":"WXYZ"}');

    clearGameSession(code);

    expect(sessionStorage.getItem(gameSnapshotKey(code))).toBeNull();
    expect(sessionStorage.getItem(`fake-it-snap-${code}`)).toBeNull();
    expect(sessionStorage.getItem(`joke-factory-snap-${code}`)).toBeNull();
    expect(sessionStorage.getItem(HOST_ROUTE_KEY)).toBeNull();
    expect(sessionStorage.getItem(JOIN_ROUTE_KEY)).toBeNull();
  });

  it('leaves the persisted player id and another room untouched', () => {
    sessionStorage.setItem('brodin-player-id', 'p-abc123');
    sessionStorage.setItem(gameSnapshotKey('OTHR'), '{"shell":2}');

    clearGameSession('WXYZ');

    expect(sessionStorage.getItem('brodin-player-id')).toBe('p-abc123');
    expect(sessionStorage.getItem(gameSnapshotKey('OTHR'))).toBe('{"shell":2}');
  });
});
