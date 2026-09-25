import { ORANGE, MUTED, TEXT, FIELD_BG, PANEL_BORDER } from './theme';

// Built from Vite's BASE_URL (not a hardcoded leading slash) so this still
// resolves once built under a subpath — see CLAUDE.md's "Deployed Asset
// Paths" guideline and src/core/AssetLoader.ts for the same pattern.
const BG_PATH = `${import.meta.env.BASE_URL}assets/branding/hushfire_menu_bg.jpg`;

export interface MainMenuCallbacks {
  onStart: () => void;
  onCreateOnline: () => void;
  onJoinOnline: (code: string) => void;
}

/** Title screen shown on load: key art with solo, online create and join actions. */
export class MainMenu {
  private root: HTMLDivElement;

  constructor(private container: HTMLElement) {
    this.root = document.createElement('div');
    this.container.appendChild(this.root);
  }

  open(callbacks: MainMenuCallbacks) {
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

    const scrim = document.createElement('div');
    scrim.style.cssText = `
      position: absolute; inset: 0; z-index: 1; pointer-events: none;
      background: linear-gradient(180deg, rgba(5,6,9,0) 45%, rgba(5,6,9,0.92) 100%);
    `;
    this.root.appendChild(scrim);

    const stack = document.createElement('div');
    stack.style.cssText = 'position: relative; z-index: 2; margin-bottom: 6%; display: flex; flex-direction: column; align-items: center; gap: 12px;';
    this.root.appendChild(stack);

    const primaryBtn = (label: string, padDefault = false) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        padding: 16px 48px; font-size: 16px; letter-spacing: 3px; font-weight: bold;
        background: linear-gradient(180deg, #FFB23E, ${ORANGE}); color: #1A0D00; border: none; border-radius: 4px;
        cursor: pointer; font-family: inherit; box-shadow: 0 0 24px rgba(255,158,27,0.45);
        transition: transform 0.15s ease;
      `;
      btn.onmouseenter = () => { btn.style.transform = 'scale(1.04)'; };
      btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
      if (padDefault) btn.dataset.padDefault = '';
      return btn;
    };

    const secondaryBtn = (label: string) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = `
        padding: 12px 36px; font-size: 13px; letter-spacing: 2px; font-weight: bold;
        background: ${FIELD_BG}; color: ${TEXT}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px;
        cursor: pointer; font-family: inherit;
      `;
      return btn;
    };

    const startBtn = primaryBtn('START GAME', true);
    startBtn.onclick = () => {
      this.close();
      callbacks.onStart();
    };
    stack.appendChild(startBtn);

    const createBtn = secondaryBtn('CREATE CO-OP SESSION');
    createBtn.onclick = () => {
      this.close();
      callbacks.onCreateOnline();
    };
    stack.appendChild(createBtn);

    const joinRow = document.createElement('div');
    joinRow.style.cssText = 'display:flex;gap:8px;align-items:center;';
    const joinInput = document.createElement('input');
    joinInput.placeholder = 'HUSH-XXXXX';
    joinInput.style.cssText = `padding:10px 12px;width:160px;font-size:13px;letter-spacing:1px;background:${FIELD_BG};color:${TEXT};border:1px solid ${PANEL_BORDER};border-radius:4px;font-family:inherit;text-transform:uppercase;`;
    const joinBtn = secondaryBtn('JOIN SESSION');
    joinBtn.onclick = () => {
      const code = joinInput.value.trim();
      if (!code) return;
      this.close();
      callbacks.onJoinOnline(code);
    };
    joinRow.appendChild(joinInput);
    joinRow.appendChild(joinBtn);
    stack.appendChild(joinRow);

    const hint = document.createElement('div');
    hint.textContent = 'Host: CREATE CO-OP SESSION first, then send the invite link. Guest opens the link while host stays in the lobby.';
    hint.style.cssText = `font-size:11px;color:${MUTED};max-width:360px;text-align:center;line-height:1.4;`;
    stack.appendChild(hint);
  }

  close() {
    this.root.innerHTML = '';
    this.root.style.cssText = 'display: none;';
    this.container.style.pointerEvents = 'none';
  }
}
