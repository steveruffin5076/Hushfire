import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveIceServers } from '../src/net/iceConfig';

describe('iceConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns STUN-only servers when no TURN URL is configured', async () => {
    vi.stubEnv('VITE_TURN_CREDENTIALS_URL', '');
    const servers = await resolveIceServers();
    expect(servers.length).toBeGreaterThanOrEqual(2);
    expect(servers.every(s => String(s.urls).startsWith('stun:'))).toBe(true);
  });

  it('merges TURN credentials from the configured REST endpoint', async () => {
    vi.stubEnv('VITE_TURN_CREDENTIALS_URL', 'https://example.test/turn');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { urls: 'turn:relay.example:443', username: 'u', credential: 'p' }
      ])
    }));

    const servers = await resolveIceServers();
    expect(servers.some(s => String(s.urls).includes('turn:relay.example'))).toBe(true);
    expect(servers.some(s => String(s.urls).startsWith('stun:'))).toBe(true);
  });
});
