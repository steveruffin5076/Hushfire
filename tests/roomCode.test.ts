import { describe, it, expect } from 'vitest';
import { generateRoomCode, normalizeRoomCode, peerIdForRoom, isRoomHash } from '../src/net/roomCode';

describe('roomCode', () => {
  it('generates HUSH- prefixed codes with 5 alphabet chars', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^HUSH-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
  });

  it('normalizes legacy ROOM- prefix', () => {
    expect(normalizeRoomCode('room-abcd2')).toBe('HUSH-ABCD2');
  });

  it('builds peer ids from room codes', () => {
    expect(peerIdForRoom('HUSH-K7M2Q')).toBe('hushfire-HUSH-K7M2Q');
  });

  it('detects invite hashes', () => {
    expect(isRoomHash('HUSH-ABCDE')).toBe(true);
    expect(isRoomHash('ROOM-1234')).toBe(true);
    expect(isRoomHash('')).toBe(false);
  });
});
