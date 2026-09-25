// Deterministic smoke test for Hushfire's window.render_game_to_text /
// window.advanceTime hooks (see .claude/skills/develop-web-game and
// progress.md §6). Needs playwright: `npm i -D playwright` once, then run a
// dev server and:
//   node scripts/dev-playtest.mjs http://localhost:5183/
// Screenshots + state JSON land in dev-playtest-output/.
import fs from "node:fs";
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5183/";
const OUT = "dev-playtest-output";
fs.mkdirSync(OUT, { recursive: true });

function log(label, obj) {
  console.log(`\n=== ${label} ===`);
  console.log(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
}

async function advance(page, ms) {
  await page.evaluate(async (ms) => {
    if (typeof window.advanceTime === "function") window.advanceTime(ms);
  }, ms);
}

async function stateOf(page) {
  const raw = await page.evaluate(() =>
    typeof window.render_game_to_text === "function" ? window.render_game_to_text() : null
  );
  return raw ? JSON.parse(raw) : null;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  // Title screen -> armory
  await page.getByText("START GAME", { exact: true }).click();
  await page.waitForTimeout(300);

  // Armory -> deploy with default loadout/difficulty
  await page.getByText("DEPLOY TO SECTOR 1", { exact: true }).click();
  await page.waitForTimeout(300);

  await page.screenshot({ path: `${OUT}/1-sector1-start.png` });

  const s0 = await stateOf(page);
  log("state before any input", s0);

  // Aim mouse at empty ground (away from the player) so shots don't immediately hit a wall right at the muzzle,
  // and so flashlight aim direction is stable.
  const canvasBox = await page.locator("canvas").boundingBox();
  await page.mouse.move(canvasBox.x + 900, canvasBox.y + 300);

  // --- Movement test: hold D (move right) for ~1s of game time ---
  await page.keyboard.down("KeyD");
  for (let i = 0; i < 60; i++) await advance(page, 1000 / 60);
  await page.keyboard.up("KeyD");
  await advance(page, 1000 / 60);

  const s1 = await stateOf(page);
  log("state after holding D for 1s", s1);
  await page.screenshot({ path: `${OUT}/2-after-move-right.png` });

  const dx = s1.players[0].x - s0.players[0].x;
  console.log(`\nP1 moved dx=${dx}px after holding D for 1s (expected ~90-260px depending on movement state)`);

  // --- Movement test: hold W (move up) for ~0.5s ---
  await page.keyboard.down("KeyW");
  for (let i = 0; i < 30; i++) await advance(page, 1000 / 60);
  await page.keyboard.up("KeyW");
  await advance(page, 1000 / 60);

  const s2 = await stateOf(page);
  log("state after holding W for 0.5s", s2);
  const dy = s2.players[0].y - s1.players[0].y;
  console.log(`\nP1 moved dy=${dy}px after holding D for 0.5s`);

  // --- Firing test: mouse-down (fire) for a few frames ---
  const magBefore = s2.players[0].mag;
  await page.mouse.down({ button: "left" });
  for (let i = 0; i < 5; i++) await advance(page, 1000 / 60);
  await page.mouse.up({ button: "left" });
  await advance(page, 1000 / 60);

  const s3 = await stateOf(page);
  log("state after firing burst", s3);
  console.log(`\nP1 mag: ${magBefore} -> ${s3.players[0].mag}`);
  await page.screenshot({ path: `${OUT}/3-after-fire.png` });

  log("console errors captured", consoleErrors);

  fs.writeFileSync(`${OUT}/states.json`, JSON.stringify({ s0, s1, s2, s3 }, null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
