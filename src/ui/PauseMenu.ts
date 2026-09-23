import { CYAN, ORANGE, TEXT, MUTED, PANEL_BG, PANEL_BORDER, FIELD_BG } from './theme';
import { showQuitScreen } from './QuitScreen';

export interface PauseMenuActions {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

/** Esc-triggered pause overlay: resume, abandon the run back to the deployment screen, or quit. */
export class PauseMenu {
  private root: HTMLDivElement;

  constructor(private container: HTMLElement) {
    this.root = document.createElement('div');
    this.container.appendChild(this.root);
  }

  show(actions: PauseMenuActions) {
    this.container.style.pointerEvents = 'auto';
    this.root.innerHTML = '';
    this.root.style.cssText = `
      position: absolute; inset: 0; background: rgba(5,6,9,0.85);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Segoe UI', monospace; color: ${TEXT};
    `;

    const card = document.createElement('div');
    card.style.cssText = `background: ${PANEL_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 6px; padding: 30px 36px; width: 300px; text-align: center; box-shadow: 0 8px 30px rgba(0,0,0,0.5);`;
    this.root.appendChild(card);

    const title = document.createElement('div');
    title.textContent = 'MISSION PAUSED';
    title.style.cssText = `font-size: 20px; letter-spacing: 4px; font-weight: bold; color: ${ORANGE}; margin-bottom: 24px;`;
    card.appendChild(title);

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
    card.appendChild(buttons);

    const resumeBtn = this.buildButton('RESUME', CYAN);
    resumeBtn.onclick = () => actions.onResume();
    buttons.appendChild(resumeBtn);

    const restartBtn = this.buildButton('RESTART — BACK TO DEPLOYMENT', 'transparent', MUTED);
    restartBtn.onclick = () => actions.onRestart();
    buttons.appendChild(restartBtn);

    const quitBtn = this.buildButton('QUIT GAME', 'transparent', MUTED);
    quitBtn.onclick = () => {
      actions.onQuit();
      showQuitScreen(this.root);
    };
    buttons.appendChild(quitBtn);
  }

  private buildButton(label: string, bg: string, color = '#05050A'): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    const filled = bg !== 'transparent';
    btn.style.cssText = `
      padding: 12px 16px; font-size: 12px; letter-spacing: 1.5px; font-weight: ${filled ? 'bold' : 'normal'};
      font-family: inherit; cursor: pointer; border-radius: 4px;
      background: ${filled ? bg : FIELD_BG}; color: ${filled ? '#05050A' : color};
      border: 1px solid ${filled ? bg : PANEL_BORDER};
    `;
    return btn;
  }

  hide() {
    this.root.innerHTML = '';
    this.root.style.cssText = 'display: none;';
    this.container.style.pointerEvents = 'none';
  }
}
