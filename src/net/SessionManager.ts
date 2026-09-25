/**
 * PeerJS-backed online lobby transport (Phase 7 milestone 1).
 * Room code lives in the URL hash; the peer id is `hushfire-${roomCode}`.
 */
import Peer, { DataConnection } from 'peerjs';
import type { NetMessage } from './Protocol';
import { PROTO_VERSION } from './Protocol';
import { generateRoomCode, isRoomHash, normalizeRoomCode, peerIdForRoom } from './roomCode';
import type { WeaponLoadout } from '../entities/Player';

export type SessionRole = 'HOST' | 'GUEST' | 'LOCAL';
export type SessionState = 'IDLE' | 'SIGNALING' | 'CONNECTED' | 'CLOSED' | 'ERROR';

const PEER_OPTS = {
  debug: 1,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
} as const;

const HOST_RETRY_MAX = 3;

export class SessionManager {
  public role: SessionRole = 'LOCAL';
  public roomCode = '';
  public state: SessionState = 'IDLE';
  public error: string | null = null;
  public connectStartedAt = 0;
  public localReady = false;
  public partnerReady = false;
  public partnerLoadout: WeaponLoadout | null = null;

  onStateChange?: () => void;
  onMessage?: (msg: NetMessage) => void;
  onDeploy?: (seed: number, hostLoadout: WeaponLoadout, guestLoadout: WeaponLoadout) => void;

  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private queue: NetMessage[] = [];
  private destroyed = false;

  constructor() {
    const hash = window.location.hash.replace('#', '').trim();
    if (isRoomHash(hash)) {
      this.roomCode = normalizeRoomCode(hash);
      this.role = 'GUEST';
    }
  }

  get isConnected(): boolean {
    return this.state === 'CONNECTED';
  }

  /** Host claims a room and waits for a guest dial-in. */
  async createHostSession(): Promise<string> {
    this.destroy(false);
    this.role = 'HOST';
    for (let attempt = 0; attempt < HOST_RETRY_MAX; attempt++) {
      this.roomCode = generateRoomCode();
      window.location.hash = this.roomCode;
      try {
        await this.openHostPeer();
        return this.roomCode;
      } catch (err) {
        if (!this.isUnavailableId(err)) continue;
      }
    }
    this.setError('Could not claim a room code — try again.');
    throw new Error(this.error ?? 'host create failed');
  }

  /** Guest dials an existing room from a pasted code or invite link. */
  joinSession(code: string) {
    this.destroy(false);
    this.roomCode = normalizeRoomCode(code);
    this.role = 'GUEST';
    window.location.hash = this.roomCode;
    this.connectAsGuest();
  }

  getShareableLink(): string {
    const url = new URL(window.location.href);
    url.hash = this.roomCode;
    return url.toString();
  }

  send(msg: NetMessage) {
    if (this.role === 'LOCAL') return;
    if (this.conn?.open) this.conn.send(msg);
    else this.queue.push(msg);
  }

  broadcastLoadout(loadout: WeaponLoadout, ready: boolean) {
    this.localReady = ready;
    this.send({ t: 'loadout', loadout, ready });
    this.onStateChange?.();
  }

  hostDeploy(seed: number, hostLoadout: WeaponLoadout, guestLoadout: WeaponLoadout) {
    if (this.role !== 'HOST') return;
    this.send({ t: 'deploy', seed, hostLoadout, guestLoadout });
    this.onDeploy?.(seed, hostLoadout, guestLoadout);
  }

  destroy(clearHash = true) {
    this.destroyed = true;
    this.send({ t: 'bye' });
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
    this.queue = [];
    this.state = 'CLOSED';
    this.error = null;
    this.connectStartedAt = 0;
    this.localReady = false;
    this.partnerReady = false;
    this.partnerLoadout = null;
    if (clearHash) window.location.hash = '';
    this.onStateChange?.();
    this.destroyed = false;
  }

  private setState(next: SessionState) {
    this.state = next;
    this.onStateChange?.();
  }

  private setError(message: string) {
    this.error = message;
    this.setState('ERROR');
  }

  private openHostPeer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setState('SIGNALING');
      this.connectStartedAt = Date.now();
      const id = peerIdForRoom(this.roomCode);
      const peer = new Peer(id, PEER_OPTS);
      this.peer = peer;

      peer.on('open', () => {
        peer.on('connection', conn => {
          if (this.conn?.open) {
            conn.close();
            return;
          }
          this.attach(conn);
        });
        resolve();
      });

      peer.on('error', err => {
        if (this.isUnavailableId(err)) reject(err);
        else this.setError(this.describePeerError(err));
      });

      peer.on('disconnected', () => {
        if (!this.destroyed) peer.reconnect();
      });
    });
  }

  private connectAsGuest() {
    this.setState('SIGNALING');
    this.connectStartedAt = Date.now();
    const peer = new Peer(PEER_OPTS);
    this.peer = peer;

    peer.on('open', () => {
      const conn = peer.connect(peerIdForRoom(this.roomCode), { reliable: true, serialization: 'json' });
      this.attach(conn);
      conn.on('open', () => {
        this.send({ t: 'hello', code: this.roomCode, proto: PROTO_VERSION });
      });
    });

    peer.on('error', err => this.setError(this.describePeerError(err)));
    peer.on('disconnected', () => {
      if (!this.destroyed) peer.reconnect();
    });
  }

  private attach(conn: DataConnection) {
    this.conn = conn;
    conn.on('open', () => {
      this.flushQueue();
      if (this.role === 'HOST') this.send({ t: 'hello', code: this.roomCode, proto: PROTO_VERSION });
      this.setState('CONNECTED');
    });
    conn.on('data', data => this.handleData(data as NetMessage));
    conn.on('close', () => this.handleDrop('Partner left the session.'));
    conn.on('error', err => this.handleDrop(err.message));
  }

  private handleData(msg: NetMessage) {
    switch (msg.t) {
      case 'hello':
        if (msg.proto !== PROTO_VERSION) {
          this.setError('Partner is on a different game version.');
          return;
        }
        if (normalizeRoomCode(msg.code) !== this.roomCode) return;
        break;
      case 'loadout':
        this.partnerLoadout = msg.loadout;
        this.partnerReady = msg.ready;
        this.onStateChange?.();
        break;
      case 'deploy':
        this.onDeploy?.(msg.seed, msg.hostLoadout, msg.guestLoadout);
        break;
      case 'bye':
        this.handleDrop('Partner left the session.');
        break;
    }
    this.onMessage?.(msg);
  }

  private flushQueue() {
    if (!this.conn?.open) return;
    for (const msg of this.queue) this.conn.send(msg);
    this.queue = [];
  }

  private handleDrop(message: string) {
    if (this.state === 'CLOSED' || this.state === 'ERROR') return;
    this.setError(message);
    this.conn = null;
  }

  private isUnavailableId(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'type' in err && (err as { type?: string }).type === 'unavailable-id';
  }

  private describePeerError(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'type' in err) {
      const type = (err as { type?: string }).type;
      if (type === 'peer-unavailable') return 'Room not found — the host may have closed the tab.';
      if (type === 'unavailable-id') return 'Room code already taken.';
      if (type === 'network' || type === 'server-error') return 'Network error — check your connection and try again.';
    }
    return 'Connection failed.';
  }
}
