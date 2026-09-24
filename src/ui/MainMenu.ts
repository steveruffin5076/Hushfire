import { ORANGE } from './theme';

// Built from Vite's BASE_URL (not a hardcoded leading slash) so this still
// resolves once built under a subpath — see CLAUDE.md's "Deployed Asset
// Paths" guideline and src/core/AssetLoader.ts for the same pattern.
const BG_PATH = `${import.meta.env.BASE_URL}assets/branding/hushfire_menu_bg.jpg`;

/** Title screen shown on load: key art with a single Start Game action into the armory. */
export class MainMenu {
  private root: HTMLDivElement;

  constructor(private container: HTMLElement) {
    this.root = document.createElement('div');
    this.container.appendChild(this.root);
  }

  open(onStart: () => void) {
    this.container.style.pointerEvents = 'auto';
    this.root.innerHTML = '';
    this.root.style.cssText = `
      position: absolute; inset: 0; background: #050508; overflow: hidden;
      display: flex; align-items: flex-end; justify-content: center;
      font-family: 'Segoe UI', monospace;
    `;

    const bg = document.createElement('img');
    bg.src = BG_PATH;
    bg.alt = 'HUSHFIRE';
    bg.style.cssText = `
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; object-position: center; z-index: 0;
    `;
    this.root.appendChild(bg);

    // Darkens the lower band so the Start button reads clearly over the key art.
    const scrim = document.createElement('div');
    scrim.style.cssText = `
      position: absolute; inset: 0; z-index: 1; pointer-events: none;
      background: linear-gradient(180deg, rgba(5,6,9,0) 55%, rgba(5,6,9,0.9) 100%);
    `;
    this.root.appendChild(scrim);

    const startBtn = document.createElement('button');
    startBtn.textContent = 'START GAME';
    startBtn.style.cssText = `
      position: relative; z-index: 2; margin-bottom: 7%;
      padding: 18px 64px; font-size: 18px; letter-spacing: 4px; font-weight: bold;
      background: linear-gradient(180deg, #FFB23E, ${ORANGE}); color: #1A0D00; border: none; border-radius: 4px;
      cursor: pointer; font-family: inherit; box-shadow: 0 0 28px rgba(255,158,27,0.5);
      transition: transform 0.15s ease;
    `;
    startBtn.onmouseenter = () => { startBtn.style.transform = 'scale(1.05)'; };
    startBtn.onmouseleave = () => { startBtn.style.transform = 'scale(1)'; };
    startBtn.dataset.padDefault = '';
    startBtn.onclick = () => {
      this.close();
      onStart();
    };
    this.root.appendChild(startBtn);
  }

  close() {
    this.root.innerHTML = '';
    this.root.style.cssText = 'display: none;';
    this.container.style.pointerEvents = 'none';
  }
}
