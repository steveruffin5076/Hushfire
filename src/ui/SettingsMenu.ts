import { CYAN, FIELD_BG, MUTED, ORANGE, PANEL_BORDER, TEXT } from './theme';
import { DEFAULT_SETTINGS, GameSettings, loadGameSettings, saveGameSettings } from './GameSettings';

export class SettingsMenu {
  private root: HTMLDivElement;

  constructor(private container: HTMLElement) {
    this.root = document.createElement('div');
    this.container.appendChild(this.root);
  }

  open(onClose: () => void) {
    const settings = loadGameSettings();
    this.container.style.pointerEvents = 'auto';
    this.root.innerHTML = '';
    this.root.style.cssText = `
      position: absolute; inset: 0; background: rgba(5,5,8,0.96);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: 'Segoe UI', monospace; color: ${TEXT};
    `;

    const title = document.createElement('h1');
    title.textContent = 'SETTINGS';
    title.style.cssText = `font-size: 22px; letter-spacing: 4px; color: ${CYAN}; margin-bottom: 24px;`;
    this.root.appendChild(title);

    const panel = document.createElement('div');
    panel.style.cssText = `width: 360px; padding: 20px; background: ${FIELD_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px;`;
    this.root.appendChild(panel);

    const row = (label: string, input: HTMLElement) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-bottom: 16px; text-align: left;';
      const lab = document.createElement('div');
      lab.textContent = label;
      lab.style.cssText = `font-size: 12px; color: ${MUTED}; letter-spacing: 1px; margin-bottom: 6px;`;
      wrap.appendChild(lab);
      wrap.appendChild(input);
      panel.appendChild(wrap);
    };

    const vol = document.createElement('input');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '100';
    vol.value = String(Math.round(settings.masterVolume * 100));
    row('MASTER VOLUME', vol);

    const sens = document.createElement('input');
    sens.type = 'range';
    sens.min = '25';
    sens.max = '200';
    sens.value = String(Math.round(settings.mouseSensitivity * 100));
    row('GAMEPAD AIM SENSITIVITY', sens);

    const pauseBlur = document.createElement('input');
    pauseBlur.type = 'checkbox';
    pauseBlur.checked = settings.pauseOnBlur;
    row('PAUSE WHEN TAB AWAY', pauseBlur);

    const close = document.createElement('button');
    close.textContent = 'SAVE & CLOSE';
    close.style.cssText = `
      margin-top: 8px; padding: 12px 28px; font-family: inherit; font-weight: bold; letter-spacing: 2px;
      background: linear-gradient(180deg, #FFB23E, ${ORANGE}); color: #1A0D00; border: none; border-radius: 4px; cursor: pointer;
    `;
    close.dataset.padDefault = '';
    close.onclick = () => {
      const next: GameSettings = {
        masterVolume: Number(vol.value) / 100,
        mouseSensitivity: Number(sens.value) / 100,
        pauseOnBlur: pauseBlur.checked
      };
      saveGameSettings(next);
      onClose();
    };
    panel.appendChild(close);
  }

  hide() {
    this.root.innerHTML = '';
    this.root.style.cssText = 'display: none;';
    this.container.style.pointerEvents = 'none';
  }
}

export { DEFAULT_SETTINGS };
