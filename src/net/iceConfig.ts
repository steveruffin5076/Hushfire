/** Default STUN servers — enough for same-LAN / permissive NAT; strict NAT needs TURN. */
const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' }
];

function dedupeIceServers(servers: RTCIceServer[]): RTCIceServer[] {
  const seen = new Set<string>();
  const out: RTCIceServer[] = [];
  for (const server of servers) {
    const urls = Array.isArray(server.urls) ? server.urls.join('|') : server.urls;
    const key = `${urls}|${server.username ?? ''}|${server.credential ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(server);
  }
  return out;
}

/**
 * ICE servers for PeerJS / RTCPeerConnection.
 * Set `VITE_TURN_CREDENTIALS_URL` to a Metered (or compatible) REST endpoint that
 * returns an `iceServers` JSON array — free tier at https://www.metered.ca/tools/openrelay/
 */
export async function resolveIceServers(): Promise<RTCIceServer[]> {
  const url = import.meta.env.VITE_TURN_CREDENTIALS_URL?.trim();
  if (!url) return STUN_SERVERS;

  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return STUN_SERVERS;
    const data = (await res.json()) as RTCIceServer[] | { iceServers?: RTCIceServer[] };
    const turn = Array.isArray(data) ? data : data.iceServers;
    if (!turn?.length) return STUN_SERVERS;
    return dedupeIceServers([...STUN_SERVERS, ...turn]);
  } catch {
    return STUN_SERVERS;
  }
}
