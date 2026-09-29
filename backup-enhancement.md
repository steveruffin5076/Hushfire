# HUSHFIRE — Enhancement Plan

**Written:** 2026-09-29
**Companion doc:** `HUSHFIRE_MARKET_RESEARCH.md` (the player-feedback research this is built from)
**What this is:** every recommendation below traces back to something real players said about a
comparable game, and points at the exact Hushfire code it would touch. Nothing here is invented taste.

> **How to use this file.** Section 0 is the short list. Section 1 is the scoreboard — for each
> complaint players keep making, what Hushfire does today and my verdict. Sections 2–5 are the work,
> tiered by how strong the evidence is. Section 6 is what *not* to build. Section 7 is a suggested
> order. Every item that changes behaviour needs its own PR and its own test (repo rule), so I've
> named the test for each one.

---

## 0. The short version

If only five things get done, do these, in this order:

| # | Change | Why it matters | Effort |
|---|---|---|---|
| **E1** | Let enraged zombies **lose track of you** (new `LOST` state) | The single most-repeated complaint in this genre is "stealth punished me with an unwinnable fight I couldn't avoid or escape." GTFO has been criticised for it for years. | **L** |
| **E2** | Draw the **noise ripple above the darkness mask** | The noise ring is the game's core readability tool, and it is currently buried under ~96% opaque black. The codebase already fixed this exact bug for the aiming reticle. | **S** |
| **E4** | Fix the **BLACKOUT dead-light dead-end** | `BLACKOUT` + a long run = the flashlight dies and never comes back, with no battery pickups. Deep Rock Galactic's own designers called this state "very brutal… you're really lost in the dark" and changed their game over it. | **S–M** |
| **E3** | Give the **evac holdout a quiet option** | Right now the finale *must* be fought. GTFO players specifically beg for "a longer, quieter route" instead of a forced fight. | **M** |
| **E11** | **Publish to a browser portal** (CrazyGames / itch.io) | The game is web-native with 6–10 minute runs — near-perfect portal material — and currently lives only on GitHub Pages, which has effectively zero discovery. Biggest player-count change available. | **M** |

Everything after that is upside, not repair.

---

## 1. Scoreboard — player complaint vs. Hushfire today

| What players say | Where Hushfire stands (verified in code) | Verdict |
|---|---|---|
| "Stealth that ends in a forced, unavoidable fight feels like being punished for playing well." (GTFO, repeatedly) | Sector-wide horde fires when any gunshot exceeds `SECTOR_ALERT_SOUND_RADIUS_PX = 150`, and the evac finale is a mandatory 90/120/150 s holdout with waves every 10 s → 4 s. | **Real gap.** Both beats are unavoidable. See E1, E3. |
| "Once they're on you, they never let go." (GTFO, In Silence) | `Zombie.alert()` returns immediately if already `ENRAGED` (`src/entities/Zombie.ts:81`). `AISystem` only runs light/sound sensing *while not enraged*, and `updateEnraged` has no exit. **There is no de-aggro path anywhere in the codebase.** Screams re-alert dormants through walls within 200 px every 4 s. | **Real gap — the biggest one.** See E1. |
| "I couldn't see what was happening." (Darkwood "too zoomed out", DRG light complaints) | The noise ripple is drawn in `HUD.renderWorldSpace` (`src/ui/HUD.ts:53`), which `Game.render` calls *before* `renderLighting` (`src/core/Game.ts:1440` vs `1444`). ShadowRenderer paints `rgba(5,5,8,0.96)` over everything outside a light cone. | **Confirmed bug.** See E2. |
| "Running out of light made the game unplayable, not scary." (DRG devs, on the record) | Battery 100 → 300 s of light, pickups +50. `BLACKOUT` starts you at 50 **and strips every battery pickup** (`src/config/sectorModifiers.ts:55`). The small always-on carry light (`CARRY_LIGHT_RADIUS`) never dies, but the flashlight is gone permanently. | **Partial gap.** Carry light saves it from unwinnable, but the climax goes dark with no recovery. See E4. |
| "The best stealth systems are legible and forgiving, not deep." (r/stealthgames consensus) | Legible: yes — noise radius is printed in px in the HUD, cones are deterministic. Forgiving: **no.** Alert is binary and permanent. | **Half done.** See E1, E5. |
| "Grind killed it." (The Blackout Club, In Silence) | Levels-only gates, losses still pay XP, full kit in ~7 wins (shipped in PR A/B). | **Already right.** Don't stretch it. |
| "Co-op-only games don't sell; it must be playable solo." (r/truegaming consensus) | Solo-first; co-op is optional 2-player over WebRTC (`src/net/`). Armory defaults to SOLO. | **Already right.** But online is the weakest link. See E10. |
| "Extraction needs a greed decision — one more corridor, or leave now?" (Lethal Company, ZERO Sievert) | Pickup types are `ammo / medkit / battery / keycard` (`src/entities/Pickup.ts:1`). No valuables, no loot to carry out, no extract-or-push choice except the pad itself. | **Real gap for the genre label.** See E8. |
| "No tutorial, no idea what I'm doing." (Murky Divers) + portals gate on the first minutes | `tutorialHint()` shows four short HUD strings in Sector 1 only (`src/config/tutorial.ts`). No interactive first-run teaching. | **Partial gap.** See E7. |
| Portals need instant fun, 30-minute sessions, a cold-start-friendly build | Instant load (Vite, 247 kB gz), touch controls exist, 6–10 min runs. Listed nowhere but GitHub Pages. `README.md` says "test game". | **Biggest untapped win.** See E11, E12. |

---

## 2. Tier 1 — Fix what this genre is punished for

### E1 — Enraged zombies must be able to lose you (new `LOST` state)

**What players said.** GTFO is the loudest example in the whole genre: players describe sneaking for
40 minutes only to hit an unavoidable alarm fight, one calling it *"like giving a safe driver a free
car accident for his renewal."* The requested fix, in their own words, is always the same — an
escape valve, not a free win.

**Where Hushfire stands.** `ENRAGED` is permanent and global-adjacent: one scream re-alerts every
dormant within 200 px *through walls*, and a horde wave adds more permanently-enraged zombies. A
player who gets spotted has exactly two options: kill everything, or die. There is no third option,
which is what makes a stealth mistake feel terminal rather than tactical.

**The change.** Add a fourth zombie state, `LOST`, between `ENRAGED` and `SUSPICIOUS`:

- Enter `LOST` when an enraged zombie has neither seen nor heard a player for `LOST_AFTER_SEC`
  (~6–10 s of quiet), **and** it has reached its last known position (or exhausted its path).
- While `LOST`: normal walk speed, no scream propagation, and it ignores sounds below
  `ZOMBIE_AWARENESS_THRESHOLD` — same rules as `SUSPICIOUS`.
- Re-entering `ENRAGED` from `LOST` must be *sticky the other way*: a second detection is faster and
  louder (shorter confirm time), so hiding is a reprieve, not an exploit.
- Screams should alert `LOST` zombies again, but with a **wall-penalised** radius instead of the
  current wall-ignoring 200 px, so a scream in another room doesn't chain the whole sector.
- Keep the sector horde exactly as it is — that's a *loudness* punishment and it's fair. The
  unfair part is individual zombies never giving up.
- Co-op rule to preserve: a downed teammate should still keep zombies engaged, so reviving stays
  tense. Gate `LOST` on "no living, non-downed player detected," not "no player at all."

**Where.** `src/config/zombies.ts` (state union), `src/entities/Zombie.ts` (`alert`, add `lastSeen`,
reset `screamCooldown`), `src/systems/AISystem.ts` (new `updateLost`, plus the `senseLight` /
`senseNearby` guards that currently short-circuit on `ENRAGED`), `src/systems/NoiseSystem.ts:63`
(scream radius), `src/core/Game.ts` (stealth stats — a `LOST` zombie should stop counting as
"alerted" for the rating, or the grade becomes un-earnable once anything wakes up).

**Effort:** L — this is the biggest single change on the list and touches the AI core.
**Tests:** `tests/aiPathing.test.ts` / new `tests/deAggro.test.ts` — enraged zombie that loses sight
for N quiet seconds transitions to `LOST`; a silent player standing still is not re-found; a
footstep at walk radius re-enrages; a downed player keeps it engaged; scream radius respects walls.
**Risk:** medium-high. This changes the difficulty curve, so it needs a playtest pass and probably a
`difficulty.ts` knob (Easy/Medium could lose you in 5 s, Hard in 12 s).

---

### E2 — Draw the noise ripple on top of the darkness

**What players said.** *"The best stealth mechanics aren't about how many systems you stack, but how
legible, expressive and forgiving those systems are when players are under pressure."* Legibility is
the genre's #1 praised quality and its #1 complaint.

**Where Hushfire stands — this is a concrete bug.** The noise ring is the tool that teaches the
whole game. It is rendered in world space at `src/core/Game.ts:1440`, and `renderLighting` runs at
`:1444`, compositing `rgba(5,5,8,0.96)` over everything outside a light cone. Move two metres away
from your own cone and your noise ring is ~96% invisible. The codebase already documents this exact
failure mode for the reticle (see the comment at `src/core/Game.ts:1449-1453` and
`src/ui/HUD.ts:59-67`) — the ripple simply never got the same treatment.

**The change.** Move `renderDecibelRipple` into the screen-space pass, next to `renderReticles`,
converting world → screen via `this.camera`. Keep the current colours and pulse. Two refinements
worth doing at the same time:
- Add a soft dark outline under the ring so it reads against both the black mask and a lit floor.
- When `noiseRadius > SECTOR_ALERT_SOUND_RADIUS_PX` (150), add a second, faster pulse in red — the
  player should *feel* the moment a shot is loud enough to call the sector down on them.

**Where.** `src/ui/HUD.ts` (split `renderWorldSpace` → screen-space ripple), `src/core/Game.ts:1440-1453`
(reorder), `src/core/Camera.ts` (already exposes world→screen).
**Effort:** S.
**Tests:** a `@vitest-environment happy-dom` test in `tests/armoryUi.test.ts`'s style asserting the
ripple is invoked after the lighting pass — simplest robust form: extract the render order into a
tiny ordered array and assert index(ripple) > index(lighting).

---

### E3 — Give the evac holdout a quiet option

**What players said.** GTFO players don't ask for the alarms to be removed; they ask for *choice*:
*"we're ok with games taking it slow & sneaking through IF that means you get a kind of upperhand."*
One player almost quit after 40 minutes of perfect stealth into a mandatory fight.

**Where Hushfire stands.** The Sector 3 evac is pure combat: `holdoutSec` 90/120/150, waves on
`surgeInterval` from 10 s down to 4 s, mix weighted 40% lurker / 25% audio-stalker / 25% bio-carrier /
10% brute. Loud, fun, and unavoidable. Meanwhile the crossbow, suppressors and the whole stealth
toolkit have no role in the climax.

**The change.** Add a **quiet holdout track** alongside the loud one — the player chooses by *how
they play*, not by a menu:

- Track stealth progress during the holdout: while **no** player fires a sector-alerting shot and no
  zombie is `ENRAGED`, the holdout timer runs **1.35× faster** ("the chopper comes in quiet") and
  surge waves spawn at 60% size.
- The moment a sector-alerting shot goes off (existing `isSectorAlertingShot`, `src/systems/HordeSurge.ts`),
  the holdout reverts to today's full pressure — permanently, but with the timer progress kept.
- Suppressed shots (crossbow, MPX-class) never trip it, which finally gives a reason to bring a
  quiet loadout into the finale.
- Surface it in the HUD: `HOLDOUT — QUIET (42s)` in green vs. `HOLDOUT — LOUD (42s)` in red, plus one
  line in the sector briefing ("stay quiet and the bird comes early").

This also makes the solo/co-op difference meaningful: solo benefits most from the quiet route.

**Where.** `src/config/difficulty.ts` (two new knobs), `src/systems/HordeSurge.ts` (pure helpers —
`quietHoldoutMult`, `quietSurgeSize` — easy to unit test), `src/core/Game.ts:1218-1290` (holdout tick),
`src/ui/HUD.ts:200-220` (label).
**Effort:** M.
**Tests:** `tests/hordeSurge.test.ts` — quiet multiplier applies only when no alerting shot fired; a
single loud shot drops it to 1.0 for the remainder; suppressed shots never trip it.

---

### E4 — Never let light reach a dead end

**What players said.** The DRG designers tried finite flares first and abandoned them: *"that was
kind of brutal, because you couldn't see anything or play the game when you used them up… we thought
it would be cool but it turned out to be very brutal."* They moved to recharging flares plus a weak
always-on headlight — and admitted they lost some fear doing it, which is a trade Hushfire can make
more cheaply.

**Where Hushfire stands.** 100 battery = 300 s of light; +50 per pickup. `BLACKOUT` starts at 50
(=150 s) and removes every battery from the map. Sector 3 alone can demand 120–150 s of holdout.
Result: a long run under `BLACKOUT` ends the climax in permanent near-darkness with the only light
being the small carry bubble. It never becomes *unwinnable* (good — the carry light exists), but the
climax of the game — the evac fight — is the one moment you cannot see it.

**The change (pick two, ideally all three):**

1. **Battery trickle.** When the flashlight is off, recharge slowly — e.g. +1 charge / 3 s, capped at
   25. Enough to always buy back a short burst of light, never enough to ignore battery pickups.
   (Costs 30 s to bank a 10 s burst; tension preserved.)
2. **Never fully empty on `BLACKOUT`.** Change the modifier to start at 50% *and* floor the battery
   at 15 (`batteryMin`) rather than 0, so the cone always returns after a cooldown. Reword the blurb
   accordingly: *"50% battery, dim reserve — no battery pickups this run."*
3. **Stop draining for a light that doesn't exist.** `rail: 'none'` has `rangePx: 0`
   (`src/config/weapons.ts:195`), but `Player.update` still drains battery whenever `flashlightOn`
   (`src/entities/Player.ts:164-167`). A rail-less loadout pays for a beam it never emits. Either
   skip the drain when the rail emits nothing, or add an explicit "no rail = no drain" note.

**Effort:** S. **Tests:** `tests/flashlight.test.ts` — trickle refills only while off and respects the
cap; `BLACKOUT` battery never falls below the floor; a `none` rail does not drain.
`tests/sectorModifiers.test.ts` already covers the pickup-stripping side.

---

## 3. Tier 2 — Make it readable and fair

### E5 — Show what each zombie is thinking

**What players said.** Praise for Darkwood: *"hard to pinpoint enemies coming at you in the dark"* —
that's atmosphere. But the same thread's top criticism is *"clunky combat"* and dying to things you
couldn't read. Both are true at once: **ambiguity in the world is good, ambiguity in the rules is
not.**

**Where Hushfire stands.** Zombie state is invisible. A dormant lurker and an enraged one differ in
animation tint (`zombieAnimKey(..., state === 'ENRAGED')`) and sound, and that's it. There is no
"Hmm, it heard something" beat, and no direction cue when a *scream* happens off-screen — which is
the most important information in the game.

**The change.** Three cheap, honest readability additions:

1. **State marks.** A small glyph above a zombie on hover/aim only (or always when in the light):
   `?` for SUSPICIOUS, `!` for ENRAGED, `·` fading out for LOST (from E1). No health bars.
2. **Off-screen sound pings.** For screams and bio-carrier blasts only — a 0.6 s directional arrow at
   the screen edge, in the event's colour. This is also the single biggest accessibility win for
   hearing-impaired players (see E6).
3. **Gradient exposure read.** When a zombie is accumulating `lightExposureTimer`, its outline warms
   from cyan to amber so "you're being seen right now" is visible *before* it's too late. This turns
   the 1.5–2.1 s `lightAwarenessTimeSec` window into a real reaction window instead of a hidden timer.

**Where.** `src/core/Game.ts` (render pass), `src/ui/HUD.ts`, `src/entities/Zombie.ts` (expose
`lightExposureTimer / lightAwarenessTimeSec`).
**Effort:** M. **Tests:** pure helpers for the glyph/ping selection are unit-testable; a DOM test that
the exposure ratio maps to the right colour band.

---

### E6 — Settings that respect different players

**What players said.** No single complaint here, but the pattern is everywhere: *"no organic
onboarding"*, *"clunky menus"*, *"too zoomed out"*, *"less flares solo"*. Players leave when the
defaults don't fit them.

**Where Hushfire stands.** `SettingsMenu` has exactly three options: master volume, gamepad aim
sensitivity, pause-on-blur (`src/ui/GameSettings.ts`). For a game whose entire premise is *audio
information*, that's thin.

**The change — ranked by value:**

| Setting | Why |
|---|---|
| **Closed captions / sound-event log** | Hushfire's danger is audio-first. A small log — `[SCREAM] NW 180px`, `[FOOTSTEPS] E` — makes the game fully playable with sound off, which also covers portal players on mute (very common in browser games). |
| **Difficulty switching from the pause menu** | Difficulty is chosen before deploy today. Blackout Club's "missions you can't preview" and GTFO's difficulty walls both bleed players. Letting someone who's struggling drop a tier mid-run keeps them playing. |
| **Colour-blind-safe palette toggle** | The HUD leans hard on green/amber/red (`NOISE:` line, health, alert colours). One alternative palette covers deuteranopia and protanopia. |
| **Zoom / camera scale** | Directly answers Darkwood's most common complaint ("too zoomed out"). Cheap if the camera already has a scale factor. |
| **Aim assist strength** | One number next to the existing sensitivity slider; helps touch and gamepad players on a tiny screen. |

**Where.** `src/ui/GameSettings.ts` (+ defaults, + load/save), `src/ui/SettingsMenu.ts`,
`src/ui/HUD.ts` (palette + captions), `src/ui/PauseMenu.ts` (difficulty).
**Effort:** M (captions are most of it). **Tests:** settings round-trip through storage; caption
formatter sorts nearest-event-first and rounds distances.

---

### E7 — Teach a cold player in 30 seconds

**What players said.** Murky Divers is dinged for having no tutorial. CrazyGames only promotes games
that hook players in the first minutes: *"games that need a five-minute tutorial before anything
happens tend to stall."* Hushfire's actual opening is a title screen → armory → four modifiers → a
3-sector run.

**Where Hushfire stands.** `tutorialHint()` gives four text strings during Sector 1
(`src/config/tutorial.ts`). It's good writing, but it's text on a HUD, and only for players already
in a run. There's no teaching of: how to sneak, that light wakes things, that the ring on the floor
is your noise, or what the objective even is.

**The change.**

1. **A 45-second interactive "TRAINING DROP"** — one room, one dormant lurker, one ammo box, and an
   exit. It forces three inputs (sneak past → toggle flashlight off → take the exit) with prompts.
   Skippable, replayable from the main menu, and **not** a story scene.
2. **Make Sector 1's first objective louder in the HUD.** Right now the briefing sits at `y=62` in
   the same style as everything else. Give the *current* objective a distinct amber banner with a
   distance arrow.
3. **A one-screen "how to survive" card on the armory** (three lines: darkness hides you, light wakes
   them, noise calls the horde) — it's the last screen before the player is committed, so it's the
   cheapest place to teach.

**Effort:** M. **Tests:** tutorial step-state machine as a pure function (enter step N → next prompt),
so `tests/tutorial.test.ts` can grow without DOM.

---

## 4. Tier 3 — Close the genre gaps

### E8 — Give the run a greed decision (optional loot)

**What players said.** This is the beating heart of the extraction genre. Lethal Company's quota
*"gives greed a mechanical purpose… every expedition creates the temptation to search another corner
even when the team should leave."* ZERO Sievert reviewers describe progression as *"that tension
starting to become a drug."*

**Where Hushfire stands.** Pickups are `ammo / medkit / battery / keycard`. Everything is a fixed,
known supply. There is no optional objective, no artifact to carry, and therefore no *"should we
really go back in?"* moment. Honestly: Hushfire is a **stealth campaign with an evac finale**, not an
extraction game — and its store copy should match whichever it becomes. This item is the one that
would change the genre it belongs to.

**The change.** Add one pickup type — call it `intel` (or "black box") — that:

- Spawns 0–2 per sector in the **farthest** room from the objective, never on the critical path.
- Pays a meaningful XP bonus **only if extracted with**, and nothing at all if you die holding it.
- Applies a small cost while carried: e.g. `+1` to your footstep noise radius (a radio pinging, a
  heavy case), so carrying it makes the rest of the run harder. This is the part that creates the
  decision — free loot isn't a decision.
- Is clearly visible in the HUD ("INTEL — 1 OF 2").

**Effort:** M (loot plumbing already exists via `Pickup` / `filterPickupsForModifier` / extraction
stats). **Tests:** intel survives `SCAVENGER` stripping (it must, or the modifier kills the feature);
intel awards XP only on successful extraction; noise penalty applies while carried.

### E9 — Let the player steer the run

**Where Hushfire stands.** One modifier is rolled per run, with a `REROLL MODIFIER` button in the
armory (`src/ui/ArmoryMenu.ts:506`) — that's a good instinct and it's already shipped. Difficulty and
loadout are previewable. What isn't: mission content. The campaign is always the same three sectors
in the same order, and `DAILY RUN`/`SURVIVAL` are separate, less-discovered modes.

**The change.** Low-effort, high-retention:
- Show the **sector chain** on the armory (SECTOR 1 → 2 → 3 with their objective types and the
  modifier), so the run is legible before committing — answers Blackout Club's "can't preview" issue.
- Surface **SURVIVAL** and **DAILY** more strongly for players who've cleared the campaign (a
  "cleared" badge plus one line: "you've extracted — now hold the helipad"). These are your replay
  modes and they're currently three menu rows away from invisible.
- Consider a **sector skip** after 3 failed attempts on the same sector: the fastest fix for the
  "we kept failing and stopped playing" churn that killed GTFO groups.

**Effort:** S–M. **Tests:** selector/progress helpers are pure.

### E10 — Make online co-op actually reachable

**Where Hushfire stands.** PeerJS/WebRTC with a session manager, ICE config in `src/net/iceConfig.ts`,
and a `TURN`-less path. The code already warns the player: *"School/corporate Wi-Fi or VPN often
blocks peer-to-peer links without a TURN relay"* (`src/net/SessionManager.ts:163`). There is no
matchmaking (correct for scope) and co-op is limited to 2.

**The change.** Small and unglamorous, but it's the difference between "co-op exists" and "co-op
works": configure a public TURN relay, and put an honest one-line compatibility note next to the
CREATE/JOIN buttons ("works best on home Wi-Fi"). Don't build matchmaking, don't raise the player
count — 2 is the design.

**Effort:** S. **Tests:** `tests/iceConfig.test.ts` already exists — extend it to assert a relay entry
is present when configured.

---

## 5. Tier 4 — Distribution (the biggest multiplier for free)

### E11 — Publish kit for browser portals

**What players said / market data.** Poki ~100 M monthly players, CrazyGames ~50 M, average session
~30 minutes, dev revenue share 60–90%, and portals gate promotion on **retention and first-session
fun**. Typical earnings for a solid portal game: **$200–$2,000/month** — not life-changing, but
Hushfire is already built.

**Where Hushfire stands.** Deployed only to GitHub Pages. `README.md` contains the words "test game".
Title tag is 54 characters of keyword soup. No store description, no capsule art, no itch page.

**The change — a one-day kit:**
1. `README.md` rewrite: what the game is, a 2-sentence pitch, controls, screenshots, link.
2. Store copy, written in the game's own voice, with the correct genre label (stealth-extraction,
   solo + 2-player co-op, 5–10 minute runs).
3. Capsule/key art + 3 screenshots (use the existing `scripts/render-ui-preview.mjs` harness and
   brand assets — this is exactly the kind of thing that harness is for).
4. itch.io listing first (fast, forgiving, good for feedback), then CrazyGames.
5. Verify the cold-start path on a phone: touch controls exist, so check the armory and HUD scale.

**Effort:** M, entirely non-code except the README.
**Test:** `npm run verify-pages-assets` should stay green after any path changes (repo already has it).

### E12 — Repo housekeeping that helps humans

`README.md` = "test game". `CLAUDE.md`/`progress.md` carry the real knowledge. Anyone who lands on the
repo (including a future contributor, or a portal reviewer) bounces. Fold the useful parts of
`progress.md`'s code map into the README and keep `progress.md` as the changelog. **Effort:** S.

---

## 6. What NOT to build (also evidence-based)

| Don't | Why |
|---|---|
| **Don't stretch the unlock curve.** | Grind is the named killer for The Blackout Club and In Silence. Levels-only gates + losses-paying-XP + full kit in ~7 wins is the correct shape. Leave it. |
| **Don't add PvP or PvPvE.** | Helldivers 2 (~$640 M) and ARC Raiders (~$230 M) own that space. PvE stealth is Hushfire's defensible niche. |
| **Don't add voice-chat-dependent mechanics.** | Lethal Company's magic is proximity voice — it's also the one thing a browser game can't reliably deliver (permissions, mic consent, portals). Don't build a design that dies without it. |
| **Don't gate content behind the hard difficulties.** | GTFO's "hardcore only" reputation is exactly why groups of friends churned out. Easy must be completable by two people who've never played. |
| **Don't make light finite with no recovery.** | Proven mistake, twice, by DRG's designers in their own words. This is what E4 is fixing — don't reintroduce it with a future modifier. |
| **Don't add a 5-minute intro cinematic.** | Portals measure the first session; the current instant-into-armory flow is right. Teach in-play (E7), not before play. |
| **Don't build matchmaking or 4-player lobbies.** | 2-player co-op is a design decision that keeps the stealth math readable (one cone each, one pad). Matchmaking adds cost for an audience the game doesn't have yet. |

---

## 7. Suggested order

**Sprint 1 — repair (all small, all evidence-backed):**
`E2` ripple above the mask · `E4` light floor + rail drain fix · `E10` TURN config · `E12` README.
*Four small PRs, one topic each, each with its test.*

**Sprint 2 — the big one:**
`E1` `LOST` state + scream wall-damping, with a playtest pass on all three difficulties.
*This one deserves a full session and a balance review.*

**Sprint 3 — the finale and the teach:**
`E3` quiet holdout · `E7` training drop.

**Sprint 4 — reach and depth:**
`E11` publish kit (do this earlier if player count matters more than polish) · `E6` accessibility ·
`E5` state readability.

**Sprint 5 — genre depth:**
`E8` intel loot · `E9` sector preview + survival/daily surfacing.

**Impact vs. effort**

| | Low effort | High effort |
|---|---|---|
| **High impact** | **E2, E4, E11** | **E1**, E3 |
| **Medium impact** | E10, E12, E9 | E5, E6, E7, E8 |

*(E2 and E4 are two of the three highest-impact items on the board and together they're smaller than
any single Tier-2 feature. Do them first.)*

---

## 8. Where each item comes from

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
| §6 | All of the above, inverted |

---

*This plan is a menu, not a commitment. Each item is independently shippable, and the repo's
one-topic-per-PR + one-test-per-behaviour rule means nothing here needs to be bundled.*
