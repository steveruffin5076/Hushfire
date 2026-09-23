# Phase 7 — Mode 1: Online URL Lobby — Implementation Plan

**Status: PLAN ONLY. Nothing in this document is implemented yet.**
Written 2026-09-23 against `main` @ `583eb4a` (PR #13).

Deliverable being specified: *"P1 clicks CREATE SESSION → gets a room code + shareable
link → P2 clicks it and connects in ~500ms → both see each other's operative/attachments
live → both hit READY TO DEPLOY."*

Source specs: `docs/COOP_SESSION_GUIDE.md` §2–§4, `docs/PLAN_AND_PHASES.md` Phase 7,
`CLAUDE.md` §5 (Multiplayer Synchronization).

---

## 1. Scope boundary — read this first

**In scope:** the complete lobby UX layer. Room code, shareable link, WebRTC connection,
live bidirectional loadout mirroring, two-player ready check, host-gated simultaneous
deploy into `Game`.

**Out of scope:** gameplay network synchronization. After both peers press deploy, each
browser constructs its own `Game` and runs its own independent local simulation with the
mirrored loadouts. Two players would see two *different* games — the zombies, damage and
extraction timer are not shared. This is a legitimate, testable milestone (it is the
entire UX contract the guide describes), but **it is not playable co-op.** Section 11
covers the follow-on milestone that makes it real.

Also out of scope: gamepad support (listed in Phase 7 and the guide, absent from
`Input.ts`), spent bullet casings (the one Phase 7 polish item not yet built — decals and
screen shake and spatial audio all already exist).

---

## 2. Architecture decision

### 2.1 Transport: PeerJS (WebRTC DataChannel)

`COOP_SESSION_GUIDE.md` §3 recommends PeerJS as Option A and PartyKit as Option B. For
this repo, PeerJS is not merely preferred — it is **the only option that fits**:

- The game deploys to **GitHub Pages**, which is static hosting. It cannot run a
  WebSocket server, so Option B means a second codebase and a second deployment target.
- PeerJS is serverless from our perspective: the free public PeerServer is used only for
  the initial signaling handshake, then the `RTCDataChannel` runs browser-to-browser.
- Zero-install, zero-port-forwarding, as the guide's Mode 1 promises.

Verified available: `npm view peerjs version` → `1.5.5`.

### 2.2 The room code *is* the peer ID

PeerJS lets a peer claim a **specific** ID rather than accepting a random one. That
collapses the entire "room system" — no lookup service, no room registry, no database:

```ts
// Host — claim the address
const peer = new Peer(`hushfire-${code}`, peerOpts);

// Guest — dial the address directly
const conn = peer.connect(`hushfire-${code}`, { reliable: true, serialization: 'json' });
```

This is what makes the guide's "~500ms" target realistic instead of aspirational: one
signaling round-trip plus ICE/DTLS setup, then a direct pipe.

Consequences to design around:
- IDs are **globally** unique on the public PeerServer, hence the `hushfire-` namespace
  prefix. Collisions are possible → must handle `unavailable-id` (see §5.4).
- Anyone who knows the code can dial the room. Acceptable for a 2-player couch-to-couch
  game; noted in §12 as a risk. A future hardening pass could add a shared secret in the
  `hello` message.

### 2.3 URL shape: hash, not query param

`https://steveruffin5076.github.io/Hushfire/#HUSH-K7M2Q`

The fragment never reaches the server, so static hosting needs no rewrite rules. The
existing `SessionManager` constructor already parses `window.location.hash`, and
`getShareableLink()` already builds from `new URL(window.location.href)` — which correctly
preserves the `/Hushfire/` subpath. Both are kept as-is.

> **Correction needed:** `COOP_SESSION_GUIDE.md` §2 shows `https://hushfire.app/#ROOM-7749`.
> That domain does not exist and the prefix does not match the code. Update the guide to
> the real Pages URL and the real prefix.

---

## 3. Step 0 — prerequisite: `.gitignore`

**This must land before `npm install peerjs`.** The repo currently has no `.gitignore` and
tracks 637 files including `node_modules/` (460 files) and `dist/` (57 files). Installing
a new dependency would commit its entire package tree.

```bash
# .gitignore
node_modules/
dist/
.DS_Store
*.local
```

```bash
git rm -r --cached node_modules dist
git add .gitignore
git commit -m "Stop tracking node_modules and dist; add .gitignore"
```

Notes:
- Files remain in git *history*, so repo size does not shrink retroactively — only future
  growth stops. A history rewrite (`git filter-repo`) would shrink it but rewrites every
  SHA; not recommended now.
- `images/` (~21 MB of raw source PNGs) is also tracked. **Keep it** — it is the source
  art that `generate_assets.py` consumes, not a build artifact. `dist/` is separately
  *stale* (missing `assets/backgrounds/`, missing `branding/hushfire_menu_bg.jpg`, and its
  `index.html` points at root-absolute `/assets/index-*.js` which 404s under the Pages
  subpath). CI rebuilds it on every deploy so production is unaffected, but untracking it
  removes the trap.
- After untracking, `progress.md`'s note about `npm run build` failing stays true locally:
  `node_modules/.bin/*` has no execute bit, so `npm run build` and `npm run typecheck`
  error with *Permission denied*. Fix with `chmod +x node_modules/.bin/*` or a clean
  `npm install`. CI is unaffected (fresh `npm ci`).

---

## 4. Protocol — `src/net/Protocol.ts` (new, ~45 lines)

Replaces `NetworkMessage.payload: any`, which is currently the only `any` in the codebase
and a direct violation of `CLAUDE.md` §3 ("Avoid `any`; use strongly typed event
interfaces"). A discriminated union makes the lobby state machine exhaustively checkable
under `strict: true`.

```ts
import type { WeaponLoadout } from '../entities/Player';

export type NetMessage =
  /** First frame after connect: lets each side confirm the code and protocol version. */
  | { t: 'hello';   code: string; proto: number }
  /** Broadcast on every local loadout/ready change (debounced — see §7.3). */
  | { t: 'loadout'; loadout: WeaponLoadout; ready: boolean }
  /** Host-only, sent once both sides are ready. Carries the deploy contract. */
  | { t: 'deploy';  seed: number; hostLoadout: WeaponLoadout; guestLoadout: WeaponLoadout }
  /** Clean disconnect, so the partner sees "left" instead of a timeout. */
  | { t: 'bye' };

export const PROTO_VERSION = 1;
```

Design notes:
- **`senderId` is dropped.** The existing `NetworkMessage` carries `senderId: number`, but
  on a 1:1 `DataConnection` you always know who the peer is. Keeping it invites bugs where
  a side trusts a self-reported ID.
- **`type: 'HANDSHAKE' | 'READY' | 'INPUT' | 'SNAPSHOT' | 'CHAT' | 'REVIVE'` is replaced.**
  `INPUT` and `SNAPSHOT` belong to the gameplay-sync milestone (§11) and should be added
  then, not stubbed now. `READY` folds into `loadout` because ready-state and loadout
  change on the same UI interactions — one message avoids ordering races between them.
- **`seed` is included now even though nothing consumes it.** When gameplay sync lands,
  deterministic zombie spawns need a shared seed; adding the field later is a breaking
  protocol change, adding it now costs one integer.
- **`proto` version field** lets a stale cached tab fail loudly ("your partner is on a
  different version") instead of silently mis-parsing.
- `serialization: 'json'` is right for the lobby: a `WeaponLoadout` serializes to ~150
  bytes, well under every browser's DataChannel limits including Safari's. The gameplay
  milestone should revisit this — 30 Hz snapshots want `serialization: 'binary'`.

### 4.1 Room code format

Current code: `HUSH-` + `Math.floor(1000 + Math.random()*9000)` → 4 digits, 9000 possible
rooms, no collision handling. The guide says "4-letter code" and shows `ROOM-7749`. Three
way mismatch.

Proposed: `HUSH-` + 5 characters from an unambiguous alphabet (no `0/O/1/I/l`) → 31^5 ≈
28.6M rooms.

```ts
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 chars, no look-alikes
export function generateRoomCode(): string {
  let out = '';
  const buf = new Uint32Array(5);
  crypto.getRandomValues(buf); // not Math.random() — codes should be unpredictable
  for (const n of buf) out += CODE_ALPHABET[n % CODE_ALPHABET.length];
  return `HUSH-${out}`;
}
```

Keep the `HUSH-` prefix so the existing constructor check (`hash.startsWith('HUSH-')`)
keeps working. Optionally also accept `ROOM-` for links copied out of the guide.

---

## 5. Transport — `src/net/SessionManager.ts` (rewrite, 87 → ~200 lines)

The existing class keeps its public surface (`role`, `roomCode`, `isConnected`,
`createHostSession()`, `joinSession()`, `getShareableLink()`, `onMessage()`, `send()`,
`dispatchIncoming()`) so nothing downstream has to change shape — but `send()` is
currently a literal no-op and `dispatchIncoming()` is never called by anything. Both get
real bodies.

### 5.1 Connection lifecycle

```ts
export type SessionState = 'IDLE' | 'SIGNALING' | 'CONNECTED' | 'CLOSED' | 'ERROR';
```

Surface this to the UI via an `onStateChange` callback. The lobby must be able to render
"CONNECTING… (412ms)" honestly rather than showing a spinner with no states behind it.

### 5.2 Host path

```ts
this.peer = new Peer(`hushfire-${this.roomCode}`, PEER_OPTS);
this.peer.on('connection', conn => this.attach(conn));   // guest dialed us
```

Single-peer room: if a second `connection` arrives while one is already open, reject it
(the room is full). Without this, a shared link posted publicly turns the host into a hub.

### 5.3 Guest path

```ts
this.peer = new Peer(PEER_OPTS);                          // random ID, we're the dialer
const conn = this.peer.connect(`hushfire-${code}`, { reliable: true, serialization: 'json' });
this.attach(conn);
```

### 5.4 `attach(conn)` — and the four things that are easy to miss

```ts
private attach(conn: DataConnection) {
  this.conn = conn;
  conn.on('open', () => { this.flushQueue(); this.onStateChange?.('CONNECTED'); });
  conn.on('data', d => this.dispatchIncoming(d as NetMessage));
  conn.on('close', () => this.handleDrop('partner left'));
  conn.on('error', e => this.handleDrop(e.message));
}
```

1. **Outbound queue.** A player can toggle READY before `conn.on('open')` fires — the
   DataChannel is not instantly writable. `send()` must buffer while closed and flush on
   open, or the first READY silently vanishes and the lobby hangs forever:
   ```ts
   send(msg: NetMessage) {
     if (this.conn?.open) this.conn.send(msg);
     else this.queue.push(msg);
   }
   ```
2. **Peer-level errors are distinct from connection-level ones.** `peer.on('error')` fires
   for `unavailable-id` (host's code already taken), `peer-unavailable` (guest dialed a
   room that isn't open), `network`, `server-error`. Only `peer-unavailable` should read
   as "Room not found — the host may have closed the tab."
3. **Host ID collision retry.** On `unavailable-id`, the host must regenerate and retry
   (bounded, e.g. 3 attempts) *before* showing the code — otherwise the player copies a
   link that can never be joined. This is why code generation cannot live in the UI.
4. **`peer.on('disconnected')` is not fatal.** It means the signaling socket dropped; the
   DataChannel may still be alive. Call `peer.reconnect()` rather than tearing down the
   session.

### 5.5 Teardown

`destroy()` must send `{t:'bye'}`, close the conn, destroy the peer, and **clear
`window.location.hash`** — otherwise the host reloading after a session immediately
re-enters GUEST mode for a dead room. `main.ts` calls this from the quit path
(`QuitScreen`) and from `Game.stop()`'s callers.

### 5.6 PeerServer config

```ts
const PEER_OPTS = { debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };
```

Keep this injectable. The free `0.peerjs.com` cloud is rate-limited and occasionally
unavailable; it is fine for development and demos but carries no SLA. A self-hosted
`peerjs-server` should be swappable via `import.meta.env` without touching call sites.

---

## 6. Entry routing — `src/main.ts` (+~30 lines)

Current flow is `mainMenu.open(() => openArmory())` → `armory.open(deploy)` →
`new Game(...)`. The session must be constructed **before** the first screen is chosen,
because the guest's entry point is the URL hash.

```ts
const session = new SessionManager();

if (session.role === 'GUEST') {
  mainMenu.close();
  openArmory('online');            // hash present → skip title, go straight to lobby
} else {
  mainMenu.open({
    onStart:        () => openArmory('solo'),
    onCreateOnline: () => { session.createHostSession(); openArmory('online'); },
    onJoinOnline:   (code) => { session.joinSession(code); openArmory('online'); }
  });
}
```

`openArmory` and `deploy` gain the session and the online case:

```ts
const deploy = (mode: GameMode, own: WeaponLoadout, partner: WeaponLoadout) => {
  activeGame?.stop();
  activeGame = new Game(
    canvas,
    mode === 'online' ? localSlotOrder(own, partner) : [own, partner],
    assets,
    callbacks,
    mode === 'solo'
  );
  activeGame.start();
};
```

`Game.ts` needs **no changes** for this milestone: it already takes
`loadouts: [WeaponLoadout, WeaponLoadout]` plus a `solo` flag.

---

## 7. Armory integration — `src/ui/ArmoryMenu.ts` (+~90 lines)

The important realization: **the lobby is not a new screen.** `ArmoryMenu` already holds
everything the lobby needs — `loadouts: [WeaponLoadout, WeaponLoadout]`, an
`editingOperative: 0 | 1` cursor, `renderLoadout()` / `renderProtocol()` re-render
functions, `setMode()` / `setOperative()` switches, a `buildModeButton()` row, and a
`fitStage()` auto-fit. The lobby is the armory with a session layer bolted on.

### 7.1 Third mode

```ts
export type GameMode = 'solo' | 'coop' | 'online';
```

Add a third button beside `SOLO ONLY` and `2-PLAYER LOCAL` (`ArmoryMenu.ts:153-154`):
`ONLINE CO-OP`. `setMode('online')` shows the operative tabs like `'coop'` does, but locks
`editingOperative` to the local player's own slot.

Three buttons in a 320px card (`buildCard` width) at `font-size: 12px` will be tight —
verify with `fitStage()` at 1280×720 and at a short viewport; may need
`letter-spacing` reduced or labels shortened to `SOLO` / `LOCAL` / `ONLINE`.

### 7.2 Partner panel is read-only

In online mode, render the partner's operative tab from the last received `loadout`
message, with all selects `disabled`. `buildStatsPanel(loadout)` already takes a loadout
argument, so it renders the partner's derived stats (damage, sound radius, the
`STEALTH_SOUND_THRESHOLD_PX` stealth judgement) with no changes — the partner's build
reads as a real loadout rather than a placeholder.

### 7.3 Debounced broadcast

Every local loadout change fires:

```ts
const broadcast = debounce(() => {
  session.send({ t: 'loadout', loadout: loadouts[mySlot], ready: iAmReady });
}, 120);
```

Hook it at the end of `renderLoadout()`'s change handlers. The debounce matters: clicking
through weapon/muzzle/rail/ammo options in quick succession would otherwise emit dozens
of packets, and `renderLoadout()` on the far side does real DOM work plus a `fitStage()`
reflow each time.

On receipt: write into the partner slot, re-render, `fitStage()`.

### 7.4 Ready check and host-gated deploy

Two status pills (local + partner). The existing `deployBtn` (`DEPLOY TO SECTOR 1`,
`ArmoryMenu.ts:354`) becomes role-dependent:

| Role | Both ready | Not both ready |
|---|---|---|
| Host | `DEPLOY TO SECTOR 1` enabled | disabled — "WAITING FOR PARTNER" |
| Guest | disabled — "WAITING FOR HOST" | disabled — "NOT READY" |

**Only the host may deploy.** That single rule is what guarantees both peers construct
`Game` with an identical loadout pair and an identical seed. Without it, a race between
two independent deploy clicks produces two different missions.

The host sends `{t:'deploy', seed, hostLoadout, guestLoadout}`; both sides then call the
same `main.ts` `deploy()` path. A guest receiving `deploy` skips its own button entirely.

### 7.5 Slot identity — subtle, get this right

`Game` assigns p1 = mouse-aimed, HUD-clickable, WASD; p2 = arrow keys + IJKL aim +
`Numpad0` fire (see `Input.ts` `getPlayer2Input`, and `HUD.getFlashlightButtonRect` from
PR #13 whose comment notes only P1's button is clickable because local co-op shares one
mouse).

If the online guest deployed with their own loadout in the **p2** slot, they would be
forced onto arrow keys and IJKL aim in their own browser — unusable. So:

> **Each peer deploys with their own loadout in the local p1 slot and the partner's in p2.**

That is exactly why the `deploy` message names fields `hostLoadout` / `guestLoadout`
rather than `p1` / `p2` — the ordering is resolved *locally* by `localSlotOrder()`.

**This holds only for the lobby-only milestone**, where each peer runs an independent sim.
The host-authoritative milestone (§11) requires stable slot identity in the simulation
(p1 = host, p2 = guest), so the guest will need a render/input **remap layer** — local
mouse drives the sim's p2, and the HUD draws the local player on the left. Flagged here so
the choice is made consciously rather than discovered mid-refactor.

---

## 8. Lobby panel — `src/ui/LobbyPanel.ts` (new, ~120 lines)

Rendered inside `deployCard.body` when mode is `'online'`. Uses `theme.ts` tokens
(`PANEL_BG`, `PANEL_BORDER`, `FIELD_BG`, `CYAN`, `ORANGE`, `MUTED`, `GREEN`, `RED`) so it
reads as the same UI as the armory, pause menu and extraction modal.

Contents:
- **Room code**, large and monospaced.
- **Shareable link** in a read-only input + `COPY LINK` button.
- **Connection status** driven by `SessionState`, with elapsed ms while connecting.
- **Two ready pills.**
- **Error copy** for the failure branches: "Room not found — the host may have closed the
  tab", "Connection lost", "Room code already taken".

### 8.1 Clipboard fallback

`navigator.clipboard.writeText()` requires a **secure context**. `https://…github.io` and
`http://localhost` qualify; a LAN IP over plain HTTP (the realistic "friend on the couch"
case for `npm run dev`) does **not**. Fall back to selecting the input and
`document.execCommand('copy')`, and catch `NotAllowedError` so the button degrades to
"select and copy manually" instead of throwing.

### 8.2 Overlay pointer-events

`#ui-overlay` is `pointer-events: none` in `index.html`; `ArmoryMenu.open()` sets
`this.container.style.pointerEvents = 'auto'`. Any lobby control rendered inside the
armory inherits that correctly, but a panel appended directly to `#ui-overlay` would not
receive clicks. Keep the lobby inside the armory's tree.

---

## 9. Main menu — `src/ui/MainMenu.ts` (+~25 lines)

Currently one button (`START GAME`, `MainMenu.ts:44`). Add two beneath it, in the same
gradient style but visually secondary:

- **CREATE CO-OP SESSION** → `session.createHostSession()` then armory in online mode.
- **JOIN SESSION** → reveals a code input → `session.joinSession(code)` then armory.

The button stack sits in the lower band over the key art with the existing `scrim`
gradient; three buttons at `margin-bottom: 7%` will need the gap reviewed so they do not
collide on short viewports.

---

## 10. File-by-file summary

| File | Change | Est. |
|---|---|---|
| `.gitignore` | **new** — Step 0 prerequisite | 4 lines |
| `package.json` | add `peerjs` dependency | 1 line |
| `src/net/Protocol.ts` | **new** — typed `NetMessage` union, `PROTO_VERSION`, code generation | ~45 |
| `src/net/SessionManager.ts` | **rewrite** — real PeerJS transport, queue, state machine, error branches, teardown | 87 → ~200 |
| `src/ui/LobbyPanel.ts` | **new** — code/link/status/ready UI, clipboard fallback | ~120 |
| `src/ui/ArmoryMenu.ts` | edit — `'online'` mode, read-only partner tab, debounced broadcast, ready check, host-gated deploy | +~90 |
| `src/ui/MainMenu.ts` | edit — CREATE / JOIN buttons, multi-callback `open()` | +~25 |
| `src/main.ts` | edit — construct session first, hash routing, `localSlotOrder` deploy | +~30 |
| `src/core/Game.ts` | **no change** | 0 |
| `docs/COOP_SESSION_GUIDE.md` | fix `hushfire.app` URL, `ROOM-` vs `HUSH-`, "4-letter" vs digits | ~6 lines |
| `CLAUDE.md` | add `net/Protocol.ts` + `ui/LobbyPanel.ts` to the directory listing | ~3 lines |

≈ **510 lines** new/changed. No simulation changes.

---

## 11. Milestones

- **M0 — Repo hygiene.** `.gitignore`, untrack `node_modules`/`dist`, fix local
  `node_modules/.bin` execute bits. Verify `npm run typecheck` and `npm run build` pass
  locally, not just in CI.
- **M1 — Transport.** `Protocol.ts` + `SessionManager` rewrite + `npm i peerjs`.
  *Verify:* two browser windows connect; `hello` round-trips; kill one and confirm the
  other reports the drop within ~2s. No UI yet — console only.
- **M2 — Entry routing + connection UX.** `MainMenu` buttons, `main.ts` hash routing,
  `LobbyPanel` status/copy-link. *Verify:* the full "click link → connecting → connected"
  path, plus every error branch by dialling a bogus code.
- **M3 — Live loadout mirror + ready check.** `ArmoryMenu` online mode. *Verify:* change
  an attachment on one side, confirm it renders on the other in under ~200ms; confirm both
  pills track; confirm only the host can deploy.
- **M4 — Docs.** Update `COOP_SESSION_GUIDE.md` and `CLAUDE.md`.
- **M5 (separate milestone, see below) — Gameplay sync.**

M1 is deliberately UI-free: transport bugs and UI bugs are much easier to tell apart when
the transport is verified through the console first.

---

## 12. Risks and gotchas

1. **Public PeerServer reliability.** `0.peerjs.com` is free, rate-limited, and
   intermittently unavailable. Mitigation: injectable config (§5.6) so a self-hosted
   `peerjs-server` can be swapped in; clear error copy when signaling fails.
2. **NAT traversal.** WebRTC needs STUN at minimum; symmetric NAT (corporate networks,
   some mobile carriers) will fail without TURN. The guide acknowledges this as the reason
   Option B exists. Shipping STUN-only means *some* pairs of players cannot connect, and
   the UI must say so rather than spinning. A paid TURN service is the real fix; out of
   scope here but should be a known limitation.
3. **Strict symmetric NAT + no TURN = "CONNECTING…" forever.** Add a connect timeout
   (~10s) that surfaces a real failure message.
4. **Room squatting.** Anyone with the code can dial in. Low stakes for 2-player co-op;
   mitigated by rejecting a second connection (§5.2).
5. **Stale hash.** A host who reloads after a session re-enters GUEST mode for a dead
   room unless `destroy()` clears the hash (§5.5).
6. **Subpath regression risk.** Nothing in this plan hardcodes asset paths, so the
   `CLAUDE.md` §4 guardrail is not directly at risk — but the shareable link must be built
   from `window.location.href`, never a hardcoded origin, or the `/Hushfire/` base
   disappears from invites.
7. **Three-way room-code mismatch** between `COOP_SESSION_GUIDE.md`, `SessionManager`, and
   this plan. Resolve in M4, and accept `ROOM-` links for one release so links copied out
   of the old guide still work.
8. **`fitStage()` reflow cost.** Partner loadout updates re-render and re-fit the stage.
   At 120ms debounce this is fine; do not remove the debounce.

---

## 13. Testing

Per `COOP_SESSION_GUIDE.md` §6. PeerJS supports **same-browser loopback**, so the whole
lobby can be verified without a second device:

1. `npm run dev` (vite is configured `host: 0.0.0.0`, `port: 3000`).
2. Window 1: `http://localhost:3000` → CREATE CO-OP SESSION → note the code.
3. Window 2: `http://localhost:3000/#HUSH-XXXXX` → should skip the title screen and
   connect.
4. Change an attachment in window 1 → confirm it appears in window 2.
5. Toggle ready in both → confirm DEPLOY enables **only** in the host window.
6. Deploy → confirm both windows enter Sector 1 (with independent simulations — expected,
   per §1).
7. Negative cases: dial a bogus code; close the host mid-lobby; reload the host after a
   session; two guests dialling one host.
8. **Repeat 2–6 against the deployed Pages build** (`https://steveruffin5076.github.io/Hushfire/`),
   not just localhost — WebRTC secure-context rules and the subpath invite link both
   behave differently in production, and `CLAUDE.md` §4 exists precisely because
   localhost-only verification has missed a deploy bug in this repo before.
9. `npm run typecheck` must stay clean — note that removing `payload: any` should take the
   codebase to zero `any`.

---

## 14. Follow-on milestone: actual gameplay sync

Not part of this plan, but recorded so the lobby's choices are made with it in mind.

**The seam is one line.** In `Game.update()`, `src/core/Game.ts:239`:

```ts
const in2 = this.input.getPlayer2Input({ x: this.p2.x, y: this.p2.y }, { x: this.p1.x, y: this.p1.y });
```

Replace that with a read from a remote input buffer and the guest's inputs drive the
host's P2. This is cheap because:
- `PlayerInputState` (`moveX, moveY, aimAngle, isFiring, isSprinting, isSneaking,
  isReloading, isInteracting, isSwitchingWeapon, selectPrimary, selectSecondary,
  isTogglingFlashlight`) is *already* essentially the guide's input packet — it needs a
  `seq` and nothing else.
- `Game.update(dt)` runs on a fixed `FIXED_DT = 1/60` accumulator, so input packets map
  cleanly onto ticks.
- Nothing in the entity layer needs refactoring.

Then the guide's §4 model: host simulates and broadcasts a ~250-byte snapshot at 30 Hz;
guest sends input at 60 Hz, predicts its own movement, interpolates the partner and
zombies.

**Why not deterministic lockstep?** It is far less code — both peers run identical
simulations and exchange only inputs — and for a 2-player fixed-timestep game it looks
tempting. It is unsafe here:

- ECMAScript leaves `Math.sin`, `Math.cos`, `Math.atan2`, `Math.pow` and `Math.exp`
  **implementation-defined** beyond requiring approximation of the mathematical value.
  `Player.update`, `CombatSystem` and `Camera` all rely on them, so Chrome and Safari can
  differ by a fraction of a ULP per frame. In a simulation where those values feed
  movement and hit detection, the peers diverge — visibly, within seconds.
- It would additionally require replacing every `Math.random()` with a seeded PRNG (the
  `seed` field in §4 is the hook for that).

Host-authoritative with client prediction is therefore the right call, as
`COOP_SESSION_GUIDE.md` §4 and `CLAUDE.md` §5 both already specify.

Also required at that point: the slot-identity remap layer flagged in §7.5, and
`{t:'input'}` / `{t:'snapshot'}` variants added to `NetMessage`.
