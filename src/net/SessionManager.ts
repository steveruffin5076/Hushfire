/**
 * HUSHFIRE — Multiplayer Session Manager
 * Handles room code generation, URL hash sharing (#ROOM-XXXX),
 * WebRTC DataChannel / WebSocket peer connections, and local fallback.
 */

export type SessionRole = 'HOST' | 'GUEST' | 'LOCAL';

export interface NetworkMessage {
  type: 'HANDSHAKE' | 'READY' | 'INPUT' | 'SNAPSHOT' | 'CHAT' | 'REVIVE';
  senderId: number;
  payload: any;
}

export class SessionManager {
  public role: SessionRole = 'LOCAL';
  public roomCode: string = '';
  public isConnected: boolean = false;
  private onMessageCallback?: (msg: NetworkMessage) => void;

  constructor() {
    // Check if player loaded the page with a room hash (e.g. #HUSH-1234)
    const hash = window.location.hash.replace('#', '').trim();
    if (hash.startsWith('HUSH-')) {
      this.roomCode = hash;
      this.role = 'GUEST';
    }
  }

  /**
   * Generates a 4-digit room code and updates browser URL
   */
  public createHostSession(): string {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    this.roomCode = `HUSH-${randomDigits}`;
    this.role = 'HOST';
    window.location.hash = this.roomCode;
    console.log(`[Session] Created Host Room: ${this.roomCode}`);
    return this.roomCode;
  }

  /**
   * Joins an existing room by code
   */
  public joinSession(code: string) {
    this.roomCode = code.toUpperCase().trim();
    this.role = 'GUEST';
    window.location.hash = this.roomCode;
    console.log(`[Session] Joining Room: ${this.roomCode}`);
  }

  /**
   * Gets the direct invite link to send to a friend
   */
  public getShareableLink(): string {
    const url = new URL(window.location.href);
    url.hash = this.roomCode;
    return url.toString();
  }

  /**
   * Registers a message listener for incoming network packets
   */
  public onMessage(callback: (msg: NetworkMessage) => void) {
    this.onMessageCallback = callback;
  }

  /**
   * Broadcasts a network packet to the connected peer
   */
  public send(_msg: NetworkMessage) {
    if (this.role === 'LOCAL') {
      // In local mode, bypass network loop
      return;
    }
    // WebRTC DataChannel or WebSocket send call
    // When using PeerJS: this.peerConnection.send(JSON.stringify(_msg));
  }

  /**
   * Dispatches an inbound packet to the registered listener. Called by the
   * WebRTC/WebSocket transport once it is wired up in Phase 7.
   */
  public dispatchIncoming(msg: NetworkMessage) {
    this.onMessageCallback?.(msg);
  }
}
