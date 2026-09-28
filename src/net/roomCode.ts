/** Unambiguous alphabet — no 0/O/1/I/l look-alikes. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** `HUSH-` + 5 random chars (~28.6M rooms). */
export function generateRoomCode(): string {
  let out = '';
  const buf = new Uint32Array(5);
  crypto.getRandomValues(buf);
  for (const n of buf) out += CODE_ALPHABET[n % CODE_ALPHABET.length];
  return `HUSH-${out}`;
}

export function normalizeRoomCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (trimmed.startsWith('HUSH-')) return trimmed;
  if (trimmed.startsWith('ROOM-')) return `HUSH-${trimmed.slice(5)}`;
  return trimmed.includes('-') ? trimmed : `HUSH-${trimmed}`;
}

export function peerIdForRoom(roomCode: string): string {
  return `hushfire-${normalizeRoomCode(roomCode)}`;
}

export function isRoomHash(hash: string): boolean {
  const code = hash.replace('#', '').trim();
  return code.startsWith('HUSH-') || code.startsWith('ROOM-');
}
