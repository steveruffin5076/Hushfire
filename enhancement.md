# HUSHFIRE — Enhancement Plan

**Written:** 2026-09-29 · **Revised:** 2026-09-29 (MGS redesign merged in)
**Companion doc:** `HUSHFIRE_MARKET_RESEARCH.md` — the player-feedback research this is built from
**Baseline:** `origin/main` @ `67a5bbc`

**What this is.** Every recommendation below traces back to something real players said about a
comparable game, and points at the exact Hushfire code it would touch. Nothing here is invented taste.

**Revision note.** This file now supersedes `MGS_REDESIGN.md`, which has been deleted — all of its
content is merged here as Tier 5. Three fixes were applied in the merge:

1. **Retracted** the earlier "EASY ships with patrols off" rule. It contradicted §9's own principle
   that no content may be gated behind difficulty, and would have hidden the flagship feature from
   the players who most need a gentle introduction. Replaced by **E19 — difficulty by density**.
2. **De-duplicated** the alert-state work. E1 and E5 are canonical here; the new vision/patrol items
   reference them instead of restating them.
3. **Added §10 — Joint tuning required**, for the two places where existing items and Tier 5
   interact numerically (`BLACKOUT` vs. darkness-as-advantage; quiet holdout vs. co-op wave size).

> **How to use this file.** §0 is the short list. §1 is the scoreboard. §2–§3 are the structural
> diagnosis that motivates Tier 5. §4–§8 are the work, tiered by evidence strength. §9 is what *not*
> to build. §10 is tuning that must happen once pieces coexist. §11 is an unanswered design
> question. §12 is risk. §13 is the order. Every behaviour change needs its own PR and its own test
> (repo rule), so each item names its test.

---

## 0. The short version

If only eight things get done, do these. Order matters — see §13.

| # | Change | Why it matters | Effort |
|---|---|---|---|
| **E2** | Draw the **noise ripple above the darkness mask** | The core readability tool is currently buried under ~96% opaque black. The codebase already fixed this exact bug for the reticle. | **S** |
| **E4** | Fix the **BLACKOUT dead-light dead-end** | `BLACKOUT` + a long run = flashlight dies permanently with no battery pickups. DRG's designers called that state "very brutal" and changed their game over it. | **S–M** |
| **E1** | Let enraged zombies **lose track of you** (new `LOST` state) | The most-repeated complaint in this genre: stealth punished with a fight you can't avoid or escape. GTFO has been criticised for it for years. | **L** |
| **E13/E14** | **Zombie vision cones + patrol routes** | Detection is currently asymmetric — the player has a cone, zombies don't. This is the change that makes Hushfire a stealth game instead of a sound-management game. | **L** |
| **E16** | **New sectors with new art** | 3 fixed geometries, 21 wall boxes, 20 zombies. Sector 2 is an open room with 2 obstacles. Route knowledge never expires. | **XL** (art-bound) |
| **E3** | Give the **evac holdout a quiet option** | The finale currently *must* be fought. GTFO players specifically beg for "a longer, quieter route." | **M** |
| **E17/E18** | **Co-op pressure scaling + split objectives** | Co-op gets no extra pressure outside the finale, and no coordination demand at all. | **M** |
| **E11** | **Publish to a browser portal** (CrazyGames / itch.io) | Web-native, 6–10 min runs, instant load — near-perfect portal material, currently on GitHub Pages with effectively zero discovery. | **M** |

---

## 1. Scoreboard — player complaint vs. Hushfire today

| What players say | Where Hushfire stands (verified in code) | Verdict |
|---|---|---|
| "Stealth that ends in a forced, unavoidable fight feels like being punished for playing well." (GTFO, repeatedly) | Sector-wide horde fires when any gunshot exceeds `SECTOR_ALERT_SOUND_RADIUS_PX = 150`, and the evac finale is a mandatory 90/120/150 s holdout with waves every 10 s → 4 s. | **Real gap.** Both beats are unavoidable. See E1, E3. |
| "Once they're on you, they never let go." (GTFO, In Silence) | `Zombie.alert()` returns immediately if already `ENRAGED` (`src/entities/Zombie.ts:81`). `AISystem` only runs light/sound sensing *while not enraged*, and `updateEnraged` has no exit. **There is no de-aggro path anywhere in the codebase.** Screams re-alert dormants through walls within 200 px every 4 s. | **Real gap — the biggest one.** See E1. |
| "I couldn't see what was happening." (Darkwood "too zoomed out", DRG light complaints) | The noise ripple is drawn in `HUD.renderWorldSpace` (`src/ui/HUD.ts:53`), which `Game.render` calls *before* `renderLighting` (`src/core/Game.ts:1467` vs `1471`). ShadowRenderer paints `rgba(5,5,8,0.96)` over everything outside a light cone. | **Confirmed bug.** See E2. |
| "Running out of light made the game unplayable, not scary." (DRG devs, on the record) | Battery 100 → 300 s of light, pickups +50. `BLACKOUT` starts you at 50 **and strips every battery pickup** (`src/config/sectorModifiers.ts:55`). The small always-on carry light never dies, but the flashlight is gone permanently. | **Partial gap.** Carry light saves it from unwinnable; the climax still goes dark with no recovery. See E4. |
| "The best stealth systems are legible and forgiving, not deep." (r/stealthgames consensus) | Legible: yes — noise radius printed in px in the HUD, cones deterministic. Forgiving: **no.** Alert is binary and permanent. | **Half done.** See E1, E5. |
| "Grind killed it." (The Blackout Club, In Silence) | Levels-only gates, losses still pay XP, full kit in ~7 wins in this branch's design — but **`main` ships achievement gates instead** (10 grade/kill references in `WeaponUnlocks.ts`). | **Unresolved.** See §11. |
| "Co-op-only games don't sell; it must be playable solo." (r/truegaming consensus) | Solo-first; co-op is optional 2-player over WebRTC (`src/net/`). Armory defaults to SOLO. | **Already right.** But online is the weakest link. See E10. |
| "There was nothing to explore — I'd seen it all." (ZERO Sievert / Blackout Club churn pattern) | **3 sectors, fixed hand-authored geometry.** Only spawn *positions* shuffle per run (`rollSectorLayout`); types and counts never change. Survival reuses Sector 3. Daily reuses all three. | **Real gap.** See §2, E16. |
| "I walked past everything — nothing was looking at me." | `AISystem`'s `DORMANT` case is literally `break;`. A spawn's `angle` is never read back. Zombies have **no field of view**; they notice only your sound, your flashlight cone, or close proximity. | **Real gap.** See §3, E13, E14. |
| "Two of us cleared it just as fast as one." | The only co-op scaling term in the entire codebase is `surgeSize(coop) → 2 : 1` (`src/systems/HordeSurge.ts:29`), and it fires **only during the evac finale**. Sectors 1–2 give two players two cones and two guns against the same 5–7 enemies. | **Real gap.** See E17, E18. |
| "No tutorial, no idea what I'm doing." (Murky Divers) + portals gate on the first minutes | `tutorialHint()` shows four short HUD strings in Sector 1 only (`src/config/tutorial.ts`). No interactive first-run teaching. | **Partial gap.** See E7. |
| Portals need instant fun, 30-minute sessions, a cold-start-friendly build | Instant load (247 kB gz), touch controls exist, 6–10 min runs. Listed nowhere but GitHub Pages. `README.md` says "test game". | **Biggest untapped win.** See E11, E12. |

---

## 2. Structural diagnosis — three maps and an empty middle

Measured from `origin/main` @ `67a5bbc`.

| Sector | Wall boxes | Zombies | World |
|---|---|---|---|
| SECTOR 1 — TRANSIT | 8 | 5 | 1940×720 |
| SECTOR 2 — BIO-LAB | **2** | 7 | 1280×720 |
| SECTOR 3 — HELIPAD | 11 | 8 | 1280×720 |
| **Campaign total** | **21** | **20** | — |

- **Sector 2 is an open room with two obstacles.** The code says why: 8 chokepoints were deleted
  because "they floated over open tile" with no visual counterpart. Honest collision, empty level.
- **Survival reuses Sector 3's helipad. Daily reuses all three sectors.** Three geometries, three modes.
- **Difficulty scales durability, never numbers:** `zombieHpMult` 0.8/1.0/1.25, `contactDps`,
  `noticeMult`, `holdoutSec`. HARD has the identical 20 zombies as EASY. `tests/playtestBalance.test.ts`
  asserts total zombie HP scales — durability, never count or behaviour.

### 2.1 The root cause: the art dictates the level design

Each sector is a **single flat 1280×720 JPEG** that doubles as the floor. The collision layer is
authored separately as `BoxDef` rectangles, and the two have drifted apart — badly enough that the
code comment for Sector 2 records walls being *deleted* because the art didn't show them.

Consequences:

1. **The player sees a cluttered world and walks through all of it.** The art is dense with crates,
   machinery, tracks and gantries; the collision layer has 21 boxes total.
2. **Procedural generation is impossible.** Generate a layout and the art won't match it. This is why
   E16 commits to new hand-authored art rather than a generator.
3. **The fix has to be a contract, not an intention** — see E15.

---

## 3. The one insight the MGS arc turns on

**Hushfire's detection is asymmetric — the player has a cone, the zombies don't.**

A zombie notices you through three channels, and all three are *your* output:

1. **Sound** — `NoiseSystem` scales an event's radius by walls crossed, compares intensity to
   `ZOMBIE_AWARENESS_THRESHOLD` / `ZOMBIE_ENRAGE_THRESHOLD`.
2. **Your light** — `senseLight()` checks whether *your* flashlight cone (from `RAIL_MODIFIERS`)
   covers the zombie, with line of sight.
3. **Proximity** — `senseNearby()` within `DORMANT_NOTICE_RADIUS` (40 px) / `SUSPICIOUS_NOTICE_RADIUS`
   (100 px), only if you're moving louder than a sneak.

A zombie has **no field of view of its own**. `angle` on a spawn is decorative — nothing reads it back.
So the game currently plays as "don't make noise near a sleeping thing": there is no *looking* to avoid.

**MGS's stealth loop is the opposite:** guards look, you read their gaze, and you cross when it's safe.
Adding zombie vision is the single change that turns Hushfire into a stealth game — and it makes
darkness and light symmetric. Your flashlight already gives you away; now their gaze gives you
something to read and time.

---

## 4. Tier 1 — Fix what this genre is punished for

### E1 — Enraged zombies must be able to lose you (new `LOST` state)

**What players said.** GTFO is the loudest example in the genre: players describe sneaking for 40
minutes only to hit an unavoidable alarm fight, one calling it *"like giving a safe driver a free car
accident for his renewal."* The requested fix is always the same — an escape valve, not a free win.

**Where Hushfire stands.** `ENRAGED` is permanent: one scream re-alerts every dormant within 200 px
*through walls*, and horde waves add permanently-enraged zombies. A spotted player has two options —
kill everything or die. There is no third option, which makes a stealth mistake terminal rather than
tactical.

**Good news in the existing code:** `SUSPICIOUS` **already de-escalates.** `updateSuspicious()` walks
to `investigateTarget` and returns to `DORMANT` after `SUSPICION_DECAY_SEC`. The decay machinery is
built; only `ENRAGED` lacks an exit.

**The change.** Add a fourth state, `LOST`, between `ENRAGED` and `SUSPICIOUS`:

- Enter `LOST` when an enraged zombie has neither seen nor heard a player for `LOST_AFTER_SEC`
  (~6–10 s of quiet), **and** it has reached its last known position (or exhausted its path).
- While `LOST`: normal walk speed, no scream propagation, ignores sounds below
  `ZOMBIE_AWARENESS_THRESHOLD` — same rules as `SUSPICIOUS`.
- Re-entering `ENRAGED` from `LOST` must be **sticky the other way**: a second detection is faster and
  louder (shorter confirm time), so hiding is a reprieve, not an exploit.
- Screams alert `LOST` zombies again, but with a **wall-penalised** radius instead of the current
  wall-ignoring 200 px, so a scream in another room doesn't chain the whole sector.
- Keep the sector horde exactly as it is — that's a *loudness* punishment and it's fair. The unfair
  part is individual zombies never giving up.
- **Co-op rule to preserve:** a downed teammate still keeps zombies engaged, so revives stay tense.
  Gate `LOST` on "no living, non-downed player detected," not "no player at all."
- **Stealth stats:** stop counting a zombie as "alerted" once it goes `LOST`, or the letter grade
  becomes un-earnable the moment anything wakes up.

**Where.** `src/config/zombies.ts` (state union), `src/entities/Zombie.ts` (`alert`, add `lastSeen`,
reset `screamCooldown`), `src/systems/AISystem.ts` (new `updateLost`, plus the `senseLight` /
`senseNearby` guards that currently short-circuit on `ENRAGED`), `src/systems/NoiseSystem.ts:63`
(scream radius), `src/core/Game.ts` (stealth stats).

**Effort:** L. **Tests:** new `tests/deAggro.test.ts` — enraged zombie losing sight for N quiet
seconds transitions to `LOST`; a silent player standing still is not re-found; a footstep at walk
radius re-enrages; a downed player keeps it engaged; scream radius respects walls.
**Risk:** medium-high — changes the difficulty curve, so it needs a playtest pass and a
`lostAfterSec` knob in `difficulty.ts` (≈5 s EASY, ≈12 s HARD).

> **Ship E1 together with E13/E14.** Vision cones plus a permanent `ENRAGED` is exactly the
> frustration GTFO is criticised for — if guards can *look* but can never *lose* you, the MGS arc
> makes the existing problem worse. See §13.

---

### E2 — Draw the noise ripple on top of the darkness

**What players said.** *"The best stealth mechanics aren't about how many systems you stack, but how
legible, expressive and forgiving those systems are when players are under pressure."*

**Where Hushfire stands — a concrete bug.** The noise ring is the tool that teaches the whole game. It
renders in world space at `src/core/Game.ts:1467`, and `renderLighting` runs at `:1471`, compositing
`rgba(5,5,8,0.96)` over everything outside a light cone. Move two metres from your own cone and your
noise ring is ~96% invisible. The codebase already documents this exact failure for the reticle (see
`src/core/Game.ts:1478-1482` and `src/ui/HUD.ts:59-67`) — the ripple never got the same treatment.

**The change.** Move `renderDecibelRipple` into the screen-space pass, next to `renderReticles`,
converting world → screen via `this.camera`. Keep current colours and pulse. Two refinements:
- Soft dark outline under the ring so it reads against both the black mask and a lit floor.
- When `noiseRadius > SECTOR_ALERT_SOUND_RADIUS_PX` (150), add a second, faster red pulse — the
  player should *feel* the moment a shot will call the sector down.

**Where.** `src/ui/HUD.ts` (split `renderWorldSpace`), `src/core/Game.ts:1467-1482` (reorder),
`src/core/Camera.ts` (already exposes world→screen).
**Effort:** S.
**Tests:** extract the render order into an ordered array and assert index(ripple) > index(lighting).

> **Priority note:** E2 gets *more* important once E13/E14 ship, because vision cones add more
> on-screen information to read — and it stays cheap. Keep it at the top of the queue (§13).

---

### E3 — Give the evac holdout a quiet option

**What players said.** GTFO players don't ask for alarms to be removed; they ask for *choice*: *"we're
ok with games taking it slow & sneaking through IF that means you get a kind of upperhand."*

**Where Hushfire stands.** The Sector 3 evac is pure combat: `holdoutSec` 90/120/150, waves on
`surgeInterval` from 10 s → 4 s, mix weighted 40% lurker / 25% audio-stalker / 25% bio-carrier /
10% brute. Meanwhile the crossbow, suppressors and the whole stealth toolkit have no role in the climax.

**The change.** A **quiet holdout track**, chosen by *how you play*, not a menu:

- While **no** player fires a sector-alerting shot and no zombie is `ENRAGED`, the holdout timer runs
  **1.35× faster** ("the chopper comes in quiet") and surge waves spawn at 60% size.
- The moment a sector-alerting shot goes off (existing `isSectorAlertingShot`), the holdout reverts to
  today's full pressure — permanently, but keeping timer progress.
- Suppressed shots (crossbow, MPX-class) never trip it, finally giving a reason to bring a quiet
  loadout into the finale.
- HUD: `HOLDOUT — QUIET (42s)` green vs. `HOLDOUT — LOUD (42s)` red, plus one briefing line
  ("stay quiet and the bird comes early").

**Where.** `src/config/difficulty.ts` (two knobs), `src/systems/HordeSurge.ts` (pure helpers),
`src/core/Game.ts:1218-1290` (holdout tick), `src/ui/HUD.ts:200-220` (label).
**Effort:** M. **Tests:** quiet multiplier applies only with no alerting shot; one loud shot drops it
to 1.0 for the remainder; suppressed shots never trip it.
**Tuning interaction:** see §10.2 — this multiplies with co-op wave size.

---

### E4 — Never let light reach a dead end

**What players said.** DRG's designers tried finite flares first and abandoned them: *"that was kind of
brutal, because you couldn't see anything or play the game when you used them up… we thought it would
be cool but it turned out to be very brutal."*

**Where Hushfire stands.** 100 battery = 300 s of light; +50 per pickup. `BLACKOUT` starts at 50
(=150 s) and removes every battery from the map. Sector 3 alone can demand 120–150 s of holdout.
Result: a long run under `BLACKOUT` ends the climax in permanent near-darkness with only the small
carry bubble. It never becomes *unwinnable* (the carry light exists), but the climax is the one moment
you cannot see it.

**The change (pick two, ideally all three):**

1. **Battery trickle.** While the flashlight is off, recharge slowly — e.g. +1 charge / 3 s, capped at
   25. Enough to always buy back a short burst, never enough to ignore pickups.
2. **Never fully empty on `BLACKOUT`.** Floor the battery at 15 (`batteryMin`) rather than 0, so the
   cone always returns after a cooldown. Reword: *"50% battery, dim reserve — no battery pickups."*
3. **Stop draining for a light that doesn't exist.** `rail: 'none'` has `rangePx: 0`
   (`src/config/weapons.ts:268`), but `Player.update` still drains whenever `flashlightOn`
   (`src/entities/Player.ts:192`). A rail-less loadout pays for a beam it never emits.

**Effort:** S. **Tests:** `tests/flashlight.test.ts` — trickle refills only while off and respects the
cap; `BLACKOUT` never falls below the floor; a `none` rail does not drain.
**Tuning interaction:** see §10.1 — `BLACKOUT` gets weaker once darkness becomes a stealth advantage.

---

## 5. Tier 2 — Make it readable and fair

### E5 — Show what each zombie is thinking

**What players said.** Praise for Darkwood: *"hard to pinpoint enemies coming at you in the dark"* —
that's atmosphere. The same thread's top criticism is *"clunky combat"* and dying to things you
couldn't read. Both are true at once: **ambiguity in the world is good, ambiguity in the rules is not.**

**Where Hushfire stands.** Zombie state is invisible. A dormant lurker and an enraged one differ by
animation tint and sound only. There is no "it heard something" beat, and no direction cue when a
*scream* happens off-screen — the most important information in the game.

**The change.** Three cheap, honest readability additions:

1. **State marks.** A glyph above a zombie on hover/aim (or always when lit): `?` SUSPICIOUS,
   `!` ENRAGED, a fading `·` for `LOST` (from E1). No health bars.
2. **Off-screen sound pings.** For screams and bio-carrier blasts only — a 0.6 s directional arrow at
   the screen edge, in the event's colour. Also the biggest accessibility win for hearing-impaired
   players (see E6).
3. **Gradient exposure read.** While a zombie accumulates `lightExposureTimer`, warm its outline from
   cyan to amber so "you're being seen right now" is visible *before* it's too late — turning the
   1.5–2.1 s `lightAwarenessTimeSec` window into a real reaction window.

**Where.** `src/core/Game.ts` (render pass), `src/ui/HUD.ts`, `src/entities/Zombie.ts` (expose
`lightExposureTimer / lightAwarenessTimeSec`).
**Effort:** M. **Tests:** pure helpers for glyph/ping selection; a DOM test that the exposure ratio
maps to the right colour band.

> **This is the same work as the MGS alert-state arc.** E1 and E5 together *are* the
> `?` → `!` → search → cooldown state machine the MGS direction needs. E13/E14 add the *looking*;
> E1/E5 make the resulting states readable and escapable. The vision/patrol items below do not
> restate this — they depend on it.

---

### E6 — Settings that respect different players

**Where Hushfire stands.** `SettingsMenu` has exactly three options: master volume, gamepad aim
sensitivity, pause-on-blur (`src/ui/GameSettings.ts`). For a game whose premise is *audio
information*, that's thin.

**The change — ranked by value:**

| Setting | Why |
|---|---|
| **Closed captions / sound-event log** | Danger is audio-first. `[SCREAM] NW 180px`, `[FOOTSTEPS] E` makes the game playable with sound off — which also covers portal players on mute (very common in browser games). |
| **Difficulty switching from the pause menu** | Difficulty is chosen before deploy today. Blackout Club's "can't preview" and GTFO's difficulty walls both bleed players. Mid-run drop keeps people playing. |
| **Colour-blind-safe palette toggle** | The HUD leans on green/amber/red. One alternative palette covers deuteranopia and protanopia. |
| **Zoom / camera scale** | Answers Darkwood's most common complaint. Cheap if the camera already has a scale factor. |
| **Aim assist strength** | One number beside the existing sensitivity slider; helps touch and gamepad on small screens. |

**Where.** `src/ui/GameSettings.ts`, `src/ui/SettingsMenu.ts`, `src/ui/HUD.ts`, `src/ui/PauseMenu.ts`.
**Effort:** M (captions are most of it). **Tests:** settings round-trip through storage; caption
formatter sorts nearest-event-first and rounds distances.

---

### E7 — Teach a cold player in 30 seconds

**What players said.** Murky Divers is dinged for having no tutorial. CrazyGames only promotes what
hooks players in the first minutes: *"games that need a five-minute tutorial before anything happens
tend to stall."*

**Where Hushfire stands.** `tutorialHint()` gives four text strings during Sector 1. Good writing, but
text on a HUD, only for players already in a run. Nothing teaches sneaking, light waking things, the
noise ring, or what the objective is.

**The change.**

1. **A 45-second interactive "TRAINING DROP."** One room, one dormant lurker, one ammo box, an exit.
   Forces three inputs (sneak past → toggle flashlight off → take the exit). Skippable, replayable,
   **not** a story scene.
2. **Make the current objective loud in the HUD.** The briefing sits at `y=62` in the same style as
   everything else. Give *the active objective* a distinct amber banner with a distance arrow.
3. **A one-screen "how to survive" card on the armory** — three lines: darkness hides you, light wakes
   them, noise calls the horde. It's the last screen before commitment, so it's the cheapest place to teach.

**Effort:** M. **Tests:** tutorial step-state machine as a pure function so `tests/tutorial.test.ts`
grows without DOM.

---

## 6. Tier 3 — Close the genre gaps

### E8 — Give the run a greed decision (optional loot)

**What players said.** Lethal Company's quota *"gives greed a mechanical purpose… every expedition
creates the temptation to search another corner even when the team should leave."*

**Where Hushfire stands.** Pickups are `ammo / medkit / battery / keycard`. Everything is a fixed,
known supply — no optional objective, no artifact to carry, and therefore no *"should we really go
back in?"* moment. Honestly: Hushfire is a **stealth campaign with an evac finale**, not an extraction
game, and its store copy should match whichever it becomes.

**The change.** Add one pickup type — `intel` (or "black box") — that:

- Spawns 0–2 per sector in the **farthest** room from the objective, never on the critical path.
- Pays a meaningful XP bonus **only if extracted with**, nothing if you die holding it.
- Applies a small cost while carried: e.g. `+1` to footstep noise radius, so carrying it makes the
  rest of the run harder. This is what creates the decision — free loot isn't a decision.
- Is clearly visible in the HUD ("INTEL — 1 OF 2").

**Effort:** M (loot plumbing exists via `Pickup` / `filterPickupsForModifier` / extraction stats).
**Tests:** intel survives `SCAVENGER` stripping (it must, or the modifier kills the feature); intel
awards XP only on successful extraction; noise penalty applies while carried.

---

### E9 — Let the player steer the run

**Where Hushfire stands.** One modifier is rolled per run with a `REROLL MODIFIER` button — good
instinct, already shipped. Difficulty and loadout are previewable. Mission content isn't: the campaign
is always the same three sectors in the same order, and `DAILY`/`SURVIVAL` are separate, less-discovered
modes. (Note: `main` has since added `'none'` to `SECTOR_MODIFIER_ORDER` and a
`RANDOM_SECTOR_MODIFIER_ORDER` that never rolls `none`.)

**The change.** Low-effort, high-retention:
- Show the **sector chain** on the armory (SECTOR 1 → 2 → 3 with objective types and the modifier), so
  the run is legible before committing — answers Blackout Club's "can't preview" issue.
- Surface **SURVIVAL** and **DAILY** more strongly for players who've cleared the campaign (a "cleared"
  badge plus one line: "you've extracted — now hold the helipad").
- Consider a **sector skip** after 3 failed attempts on the same sector — the fastest fix for the
  "we kept failing and stopped playing" churn that killed GTFO groups.

**Effort:** S–M. **Tests:** selector/progress helpers are pure.

---

### E10 — Make online co-op actually reachable

**Where Hushfire stands.** PeerJS/WebRTC with a session manager, ICE config in `src/net/iceConfig.ts`,
and a `TURN`-less path. The code already warns: *"School/corporate Wi-Fi or VPN often blocks
peer-to-peer links without a TURN relay"* (`src/net/SessionManager.ts:163`). No matchmaking (correct
for scope); co-op limited to 2.

**The change.** Configure a public TURN relay, and put an honest one-line compatibility note next to
CREATE/JOIN ("works best on home Wi-Fi"). Don't build matchmaking, don't raise the player count — 2 is
the design.

**Effort:** S. **Tests:** extend `tests/iceConfig.test.ts` to assert a relay entry is present when
configured.

> **Sequencing note:** E10 must land **before** E18 (split objectives). §1 already warns that
> 2-player-only co-op with no matchmaking means "a player without a friend cannot use the feature at
> all" — building co-op-only content while co-op is still unreachable means building content most
> players never see. See §13.

---

## 7. Tier 4 — Distribution (the biggest multiplier for free)

### E11 — Publish kit for browser portals

**Market data.** Poki ~100 M monthly players, CrazyGames ~50 M, average session ~30 minutes, dev
revenue share 60–90%, and portals gate promotion on **retention and first-session fun**. Typical
earnings for a solid portal game: **$200–$2,000/month**.

**Where Hushfire stands.** Deployed only to GitHub Pages. `README.md` contains the words "test game".
Title tag is keyword soup. No store description, capsule art, or itch page.

**The change — a one-day kit:**
1. `README.md` rewrite: what the game is, a 2-sentence pitch, controls, screenshots, link.
2. Store copy in the game's voice, with the correct genre label (stealth-extraction, solo + 2-player
   co-op, 5–10 minute runs).
3. Capsule/key art + 3 screenshots (use `scripts/render-ui-preview.mjs` and existing brand assets).
4. itch.io first (fast, forgiving, good for feedback), then CrazyGames.
5. Verify the cold-start path on a phone: touch controls exist — check armory and HUD scale.

**Effort:** M, non-code except the README.
**Test:** `npm run verify-pages-assets` stays green after any path changes.
**Note:** claims here about instant loading must be re-checked after E16 adds art — see §10.3.

---

### E12 — Repo housekeeping that helps humans

`README.md` = "test game". `CLAUDE.md`/`progress.md` carry the real knowledge. Anyone landing on the
repo (a contributor, or a portal reviewer) bounces. Fold the useful parts of `progress.md`'s code map
into the README and keep `progress.md` as the changelog. **Effort:** S.

---

## 8. Tier 5 — The MGS arc

The work that moves Hushfire from "sound-management game" (§3) to a stealth game. Ordered so each item
is useful on its own, and so no item ships without the fairness work it depends on.

### E13 — Zombie vision cones

**The change.** Give zombies a field of view, mirroring the math `senseLight()` already uses — but
inverted, so the *zombie* owns the cone.

`src/config/zombies.ts` — extend `ZombieDef`:

```ts
visionRangePx: number;        // e.g. 260 lurker / 300 brute / 0 audio-stalker
visionConeRad: number;        // e.g. 70°–100°
visionConfirmSec: number;     // time in cone before escalating
```

`src/systems/AISystem.ts` — new `senseSight()`:

- For each living player: distance ≤ `visionRangePx`, angle within `visionConeRad / 2` of the
  **zombie's** `angle`, and `map.hasLineOfSight(zombie.position, player.position)`.
- Accumulate `visionExposureTimer`; escalate at `visionConfirmSec`.
- **Darkness multiplies the range** — this keeps the best mechanic intact. Proposed:
  `effectiveRange = visionRangePx * (playerLit ? 1.0 : 0.35)`, where `playerLit` is true if the
  player's flashlight is on and aimed roughly toward the zombie, or they fired recently
  (`muzzleFlashTimer > 0`). A player moving with the light off is genuinely hard to see; a lit player
  is a beacon.
- **Audio-stalkers keep `visionRangePx: 0`** — they stay the "you can never see it coming" threat,
  preserving archetype identity.

**Fairness rules (non-negotiable — these exist because GTFO's most-repeated criticism is unavoidable,
unreadable detection):**

1. **Never detect from off-screen.** Cap `visionRangePx` at ~320 px (the play area is 1280×720;
   anything larger can see you before you can see it).
2. **Telegraph the gaze.** Draw the cone (dimly, in your light) for any zombie you can currently see —
   and *always* draw the cone of a zombie accumulating exposure on you. If a zombie is about to spot
   you, you must be able to see that it is.
3. **Sneak stays silent to vision too** — do not let vision bypass the sneak/stand-still escape that
   `senseNearby()` already respects.
4. **Patrols and vision ship on every difficulty** — scaled, never removed. See E19.

**Effort:** L. **Tests:** a player directly in front at 200 px is spotted; the same player at 300 px is
not; the same player at 200 px with the flashlight off is not (shortened range); a wall between them
blocks detection.

---

### E14 — Patrol routes

**The change.** `case 'DORMANT': break;` becomes a state machine.

`src/config/sectors.ts` — extend `ZombieSpawnDef`:

```ts
patrol?: Point[];   // ordered waypoints; absent = static (today's behaviour)
dwellSec?: number;  // seconds to pause and sweep at each waypoint
```

Both optional, so **every existing sector keeps working unchanged** and E14 can ship before E16.

- **No `patrol`** → today's behaviour, exactly (static). Backwards compatible.
- **With `patrol`** → `steer()` toward `patrol[i]` at `walkSpeed * patrolSpeedMult`; on arrival, hold
  for `dwellSec` while sweeping `angle` smoothly across an arc (e.g. ±50°); advance to `patrol[i+1]`,
  looping or ping-ponging on a two-point route.
- Reuse the existing `NavGrid` A* that `steer()` already uses for `investigateTarget` — patrols route
  around walls for free.
- **Suspicion interrupts the route:** on `SUSPICIOUS`, walk to `investigateTarget` as today, then
  **return to the nearest waypoint** instead of dropping to DORMANT in place. A small change to
  `updateSuspicious()`, and it's what makes patrols feel like they have a job.

**Effort:** M. **Tests:** a zombie with a patrol advances waypoints and loops; it returns to its route
after investigating; a zombie with no `patrol` never moves (regression guard).

---

### E15 — The art ↔ collision contract, and the tool that enforces it

**Build this first — it's small, and it's what stops the Sector 2 mistake from repeating.**

> **The contract:** every `box` must be visibly a solid object in the background art. Every solid mass
> in the art must have a matching `box`.

**The tool.** A dev-only debug overlay that draws every `BoxDef` outline on top of the sector
background at 1:1, toggled by a key in dev builds. Ten minutes of work, and it makes the contract
checkable by eye instead of by memory.

**Effort:** S. **Tests:** none needed (dev-only), but keep it out of production builds.

---

### E16 — New sectors with new art

**Art spec per sector:**

| Requirement | Value |
|---|---|
| Resolution | 1280×720 (matches the current three) |
| Layout | **Top-down**, orthographic, no perspective — the camera is straight down |
| Coverage | Must tile the whole world; Sector 1's world is 1940 px wide, so specify `worldMaxX` first |
| Readability | Distinct floor vs. wall vs. prop values — the darkness mask eats ~96% of contrast, so props must read as silhouettes |
| Solid objects | 12–20 per sector, each a clear mass (crates, machinery, pillars, vehicles, debris) |
| Routes | At least **two** viable paths between spawn and objective |
| Chokepoints | 2–4, so patrols have something to guard |
| Choke safety | No single chokepoint may be the only route (mirrors the keycard soft-lock lesson) |
| Lit vs dark | Deliberately include bright pools (visible danger) and black zones (cover) |
| Colour | Cool/desaturated, so the amber HUD and green noise ring stay readable |

**Sectors to author, matching the campaign's escalation:**

- **SECTOR 2 rework** — the existing BIO-LAB art's two grates are its only solid objects. Either
  re-art it with quarantine machinery, or accept it as the "open kill-floor" and give it patrol-heavy
  enemies so the emptiness *is* the threat. **This should ship with or before E13/E14** — patrols in an
  empty room accomplish nothing.
- **2–3 additional sectors** — 3 sectors is a 6–10 minute campaign, right for a portal but thin for
  replay. More sectors raise run length and, more importantly, route variety.
- **A survival-specific arena** — the mode currently borrows Sector 3. One map's art budget gives
  Survival its own identity.

**Engineering:**

- **Lazy-load backgrounds per sector.** Each JPEG is ~220–270 KB; three more adds ~700 KB to the
  initial bundle. Portal audiences bounce on slow first loads — load the current sector's art on
  transition, not everything up front. (See §10.3.)
- `src/core/AssetLoader.ts`: extend the `AssetKey` union and path map (`sector4_bg` …).
- `tests/sectors.test.ts` already validates that every spawn spot (primary **and** `alts`) is inside
  the map, not in a wall, and reachable. New sectors must pass it unchanged — keep authoring `alts`.
- Respect `MIN_ZOMBIE_SPAWN_DIST` (200 px) from player spawns.

**Effort:** XL (art-bound, not code-bound). **Tests:** existing `tests/sectors.test.ts` is the guardrail.

---

### E17 — Co-op pressure scaling

**Add bodies, not health.** Inflating HP makes fights longer; adding bodies makes them more spatial.

- Add a single `coopScale` term meaning "P2 present and not eliminated."
- Extra zombies per sector on co-op: **+40%** (rounded), drawn from cheap archetypes (`lurker`,
  `audio_stalker`) so co-op doesn't just mean more brutes.
- **Do not change per-zombie HP.** Difficulty already owns durability.
- Extra patrol routes on co-op — a second wandering guard is worth more to the fantasy than a third
  stationary one.
- Keep the existing `surgeSize(coop) → 2 : 1` evac scaling as-is.

**Effort:** M. **Tests:** `coopScale` never applies when P2 is eliminated; co-op zombie count is 1.4×
solo count; per-zombie HP is identical solo and co-op.

---

### E18 — Split objectives on co-op

**The change.** MGS Peace Walker's co-op tension comes from two players having to be in two places.

- `SectorDef` gains an optional second objective (`objectiveB`) that, on co-op, **must be held
  simultaneously** with `objectiveA` for `holdSec` — each player's hold counts only while the other's
  does too.
- **On solo there is no change at all** — objectives resolve sequentially as today. This is the key
  property: the feature costs solo players nothing, which matters because the research says
  co-op-only design is a commercial trap.
- **Graceful fallback (required):** if either player is downed or eliminated, the pair reverts to
  sequential. Without this, a downed P2 soft-locks the run — the same class of bug as the old
  every-other-entry strip that deleted the Sector 1 keycard on `SCAVENGER` rolls.
- HUD: show both objectives with a shared "BOTH HELD" meter.

**Effort:** M. **Tests:** solo runs never require simultaneity; co-op requires both held; downing P2
reverts to sequential and the run stays completable.

> **Sequencing:** E10 before E18 (see E10's note and §13).

---

### E19 — Difficulty by density

**This replaces the retracted "EASY ships with patrols off" rule.** Patrols and vision cones ship on
**all three difficulties**, scaled rather than removed — otherwise the flagship feature is invisible to
exactly the players §9 says must be able to finish the game.

| | Patrols | Vision | Extra spawns |
|---|---|---|---|
| **EASY** | 1 slow patroller per sector | Shorter cone, longer confirm | none |
| **NORMAL** | Full routes | As specified in E13 | none |
| **HARD** | Full routes + tighter dwell (less idle time) | Full cone, shorter confirm | +1–2 per sector |

This also finally fixes the finding in §2 — that HARD today has the *identical 20 zombies* as EASY —
by adding a behavioural axis (routes, dwell, sweep speed) alongside the existing durability axis.

**Effort:** M. **Tests:** extend `tests/playtestBalance.test.ts` — HARD patrol dwell is shorter than
EASY's; HARD zombie count exceeds EASY's; every difficulty has at least one patrolling zombie.

---

## 9. What NOT to build (also evidence-based)

| Don't | Why |
|---|---|
| **Don't stretch the unlock curve.** | Grind is the named killer for The Blackout Club and In Silence. Levels-only gates + losses-paying-XP + full kit in ~7 wins is the correct shape. **Note:** `main` currently ships achievement gates instead — see §11 for the unresolved conflict. |
| **Don't add PvP or PvPvE.** | Helldivers 2 (~$640 M) and ARC Raiders (~$230 M) own that space. PvE stealth is Hushfire's defensible niche. |
| **Don't add voice-chat-dependent mechanics.** | Lethal Company's magic is proximity voice — also the one thing a browser game can't reliably deliver (permissions, mic consent, portals). Don't build a design that dies without it. |
| **Don't gate content behind the hard difficulties.** | GTFO's "hardcore only" reputation is exactly why groups of friends churned out. Easy must be completable by two people who've never played — and, per this principle, must contain the game's actual mechanics. **This is why the "EASY ships with patrols off" idea was retracted in favour of E19.** |
| **Don't make light finite with no recovery.** | Proven mistake, twice, by DRG's designers in their own words. This is what E4 fixes — don't reintroduce it with a future modifier. |
| **Don't add a 5-minute intro cinematic.** | Portals measure the first session; the instant-into-armory flow is right. Teach in-play (E7), not before play. |
| **Don't build matchmaking or 4-player lobbies.** | 2-player co-op keeps the stealth math readable (one cone each, one pad). Matchmaking adds cost for an audience the game doesn't have yet. |
| **Don't build a procedural generator over the current art.** | Each sector is one flat JPEG — a generated layout cannot match it (§2.1). Variety comes from authored art (E16), and a tile-based renderer would be the prerequisite if generation is ever wanted. |

---

## 10. Joint tuning required

These are not blockers, but each is a place where two items interact numerically. Someone must run the
numbers once both halves exist.

### 10.1 E4 (light never fails) × E13 (darkness is a stealth advantage)

E13 makes an unlit player ~65% harder to see, which **reduces the cost of running out of light** — so
`BLACKOUT` gets weaker, not stronger, once vision ships. The E4 battery floor and trickle are still
correct (the DRG lesson is about unplayable states, not difficulty), but `BLACKOUT`'s identity needs
re-checking: it may need a different handicap than "less light" — e.g. louder footstep radius, or
fewer medkits.

### 10.2 E3 (quiet holdout) × E17 (co-op evac scaling)

E3's quiet track is 1.35× timer and 0.6× wave size; E17 keeps `surgeSize(coop) → 2 : 1`. Combined, a
quiet co-op holdout is `2 × 0.6 = 1.2` zombies per wave against a 1.35× timer — still easier than
today's loud solo holdout. Decide whether the quiet route should be *proportionally* as generous in
co-op, or whether two players should need to stay quieter to earn it.

### 10.3 E11 (instant load as a selling point) × E16 (new art)

E11 lists "instant load (247 kB gz)" as a portal asset. Three more sectors add ~700 KB of JPEGs. E16
prescribes lazy-loading; E11's copy must not claim a number that stops being true, and the cold-start
path should be re-measured on a throttled connection after E16.

---

## 11. Open decision — unlock gates

`main`'s `src/ui/WeaponUnlocks.ts` gates weapons by **achievements** —

```ts
vector: p => p.totalWins >= 1 && gradeAtLeast(p, 'C'),
p90:    p => p.totalKillsBest >= 25,
dmr:    p => gradeAtLeast(p, 'A'),
```

— while §9 of this document says levels-only gates, with grades and kills as records. Both cannot
hold, and the repo currently documents a philosophy it doesn't follow.

| | Design | Feel |
|---|---|---|
| **A** | Keep main's achievement gates as merged | Rewards skill expression; unlock hints read as challenges; some players never see late weapons |
| **B** | Replace with levels-only | Every player reaches the full kit in ~7–8 runs; predictable; matches "fast pace" |
| **C** | Hybrid — level gates for the ladder, achievements for cosmetics/records | Keeps fast kit access while preserving bragging rights |

**Recommendation: C.** The research is unambiguous that grind and gated content kill small co-op
games, and grades/kills already have a home in the letter grade and the records screen. A is defensible
if the unlock hints should be aspirational. **Whichever is chosen, the losing side must be corrected** —
either §9's line or the 10 gate references in `WeaponUnlocks.ts`.

Also unresolved: a parallel uncommitted branch adds 3 weapons (`vp9_whisper`, `shockwave`, `mk14_ebr`)
and a `spreadRad` accuracy mechanic that `main` lacks. Those add build variety to the reward ladder and
are largely orthogonal to whichever gate philosophy wins — but see the repository-durability warning in
§14 before relying on that branch.

---

## 12. Risks, honestly

| Risk | Mitigation |
|---|---|
| **Patrols in an empty room are pointless.** E13/E14 on today's Sector 2 changes nothing meaningful. | Ship the Sector 2 rework (E16) with or before E13/E14. |
| **Vision cones + permanent ENRAGED = GTFO's complaint, made worse.** | E1 ships with E13/E14. Non-negotiable. |
| **New art is the real cost.** Three sectors ≈ 3 detailed 1280×720 top-down images. | One sector at a time; E15's overlay makes each verifiable. |
| **Patrols reduce forgiveness in a game built on it.** | `patrolSpeedMult` slow, wide dwell, E19 scales rather than removes, `lostAfterSec` knob in E1. |
| **Initial load grows** (~700 KB of new JPEGs) — a portal-retention risk. | Lazy-load per sector (E16). |
| **Solo players get nothing from E18.** | Explicitly by design; paired objectives activate only with P2 present. |
| **Co-op content unreachable without TURN.** | E10 before E18. |
| **Conflicting unlock philosophies.** | Resolve §11 before touching `WeaponUnlocks.ts`. |

---

## 13. Suggested order

A single queue. Two rules govern it: **the cheap confirmed bugs stay at the top** (they're hours of
work, fully independent of the redesign, and E2 gets *more* valuable once cones exist), and **no
fairness item ships after the thing that makes it necessary**.

| Phase | Work | Why now |
|---|---|---|
| **0** | Resolve branch/`main` divergence (§14) · E15 overlay · decide §11 | Everything else builds on a clean base |
| **1** | **E2** ripple above the mask · **E4** light floor + rail drain fix · **E10** TURN config · **E12** README | Small, confirmed, unblocked. E10 specifically must precede E18. |
| **2** | **E1** `LOST` state + **E5** indicators | The escape valve. Ship before vision so the difficulty curve is already fixed. |
| **3** | **E13** vision cones + **E14** patrols + **E19** density scaling | The flagship change. Needs Phase 2 first. |
| **4** | **E15**→ already done in Phase 0 · **E16** Sector 2 rework, then 2–3 new sectors | Turns systems into content. Sector 2 rework gates Phase 3's value. |
| **5** | **E17** co-op pressure + **E18** split objectives | Needs patrols and maps to be worth it, and E10 to be reachable. |
| **6** | **E3** quiet holdout + **E7** training drop | Polish on a working loop |
| **7** | **E11** publish kit · **E6** accessibility · **E8** intel loot · **E9** run steering | Reach and depth — E11 can move earlier if player count matters more than polish |

**Impact vs. effort**

| | Low effort | High effort |
|---|---|---|
| **High impact** | **E2, E4, E11** | **E1**, E13/E14, E16 |
| **Medium impact** | E10, E12, E9, E15 | E3, E5, E6, E7, E17, E18, E19 |

---

## 14. Repository notes

- **`main` is the baseline.** This document was verified against `origin/main` @ `67a5bbc`, which
  already contains an earlier revision of this file (merged as PR #47).
- **Branch state:** `arena/01a0e6f6-hushfire` sits at `be7b6fb`, 38 files behind `main`, with a
  parallel progression implementation uncommitted in the working tree (`src/ui/Progression.ts`,
  3 extra weapons, `xpMult`, an end-of-run XP block). `main` has its own `src/ui/PlayerProgress.ts`
  and an armory **OPERATIVE LEVEL** bar that overlap most of it.
- **Durability warning:** the sandbox used for this analysis **re-clones the repository between
  sessions** — a commit made there did not survive. Files persisted; git history did not. **Make
  commits and pushes from a durable session.**
- **`MGS_REDESIGN.md` was merged into this file and deleted**, so this is the single source of truth
  for the plan. If a section below is later superseded, edit it here rather than adding a parallel doc.

---

## 15. Sources

**Item → evidence:**

| Item | Primary evidence |
|---|---|
| E1 | GTFO thread: *"safe driver a free car accident"*, *"almost dropped the game completely"*, *"our group slowly fell off it"* — `HUSHFIRE_MARKET_RESEARCH.md` §2.1 |
| E2 | r/stealthgames legibility consensus (§2.3) + the repo's own reticle comment |
| E3 | GTFO players requesting *"a longer, quieter route"* (§2.1) |
| E4 | DRG designers on finite flares (§2.2) |
| E5 | Darkwood praise/criticism split, Intravenous 2 details (§2.3) |
| E6 | Darkwood *"too zoomed out"*, Murky Divers onboarding, portal mute-play (§2.6) |
| E7 | Murky Divers no-tutorial complaints; CrazyGames first-session gating (§2.6) |
| E8 | Lethal Company greed design; ZERO Sievert progression (§2.7) |
| E9 | Blackout Club: repetitive missions, no preview (§2.4) |
| E10 | Solo-vs-co-op consensus (§2.5) |
| E11 | Poki/CrazyGames reach, rev shares, cold-start gating (§2.6) |
| E12 | Portal review practice + reader sanity |
| E13, E14 | §3 (asymmetric detection) — measured from `AISystem.ts`, `Zombie.ts`, `NoiseSystem.ts` |
| E15, E16 | §2 (three maps, 21 boxes, art-dictating-design) — measured from `sectors.ts`, `sectorLayout.ts` |
| E17, E18 | §2 + co-op consensus (§2.5) — `surgeSize` is the only co-op term in the codebase |
| E19 | §9's "don't gate content behind difficulty" + §2's difficulty-scales-durability-only finding |
| §9, retraction | The retracted "EASY ships with patrols off" rule conflicted with §9; replaced by E19 |
| §11 | `main`'s `WeaponUnlocks.ts` vs. the levels-only decision |

**Measured from the codebase** (`origin/main` @ `67a5bbc`): sector/zombie/pickup counts and `BoxDef`
totals (`src/config/sectors.ts`), spawn-shuffle behaviour (`src/config/sectorLayout.ts`), AI states
(`src/systems/AISystem.ts`), co-op scaling (`src/systems/HordeSurge.ts`), difficulty axes
(`src/config/difficulty.ts`), flashlight constants (`src/config/constants.ts`,
`src/entities/Player.ts`), unlock gates (`src/ui/WeaponUnlocks.ts`).

**External research** behind the player-feedback claims: `HUSHFIRE_MARKET_RESEARCH.md`, §1–§4.

---

*This plan is a menu, not a commitment. Each item is independently shippable, and the repo's
one-topic-per-PR + one-test-per-behaviour rule means nothing here needs to be bundled — with two
stated exceptions: E1 ships with E13/E14, and E10 ships before E18.*
