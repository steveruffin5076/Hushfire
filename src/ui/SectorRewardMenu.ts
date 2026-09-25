import { CYAN, ORANGE, TEXT, MUTED, PANEL_BG, PANEL_BORDER } from './theme';

export type SectorReward = 'medkit' | 'ammo' | 'battery';

const REWARDS: { id: SectorReward; label: string; detail: string }[] = [
  { id: 'medkit', label: 'FIELD MEDKIT', detail: '+50 HP to each operative' },
  { id: 'ammo', label: 'AMMO CRATE', detail: '+2 magazines per weapon' },
  { id: 'battery', label: 'TACTICAL BATTERY', detail: '+50 flashlight charge' }
];

/** Between-sector reward picker — medkit, ammo or battery before the next sector loads. */
export class SectorRewardMenu {
  private root: HTMLDivElement;

  constructor(private container: HTMLElement) {
    this.root = document.createElement('div');
    this.container.appendChild(this.root);
  }

  show(sectorName: string, nextSectorName: string, onChoose: (reward: SectorReward) => void) {
    this.container.style.pointerEvents = 'auto';
    this.root.innerHTML = '';
    this.root.style.cssText = `
      position: absolute; inset: 0; background: rgba(5,5,8,0.94);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: 'Segoe UI', monospace; color: ${TEXT}; text-align: center;
    `;

    const title = document.createElement('h1');
    title.textContent = 'SECTOR CLEARED';
    title.style.cssText = `font-size: 26px; letter-spacing: 4px; color: ${CYAN}; margin-bottom: 8px;`;
    this.root.appendChild(title);

    const sub = document.createElement('div');
    sub.textContent = `${sectorName} secured — choose a supply drop for ${nextSectorName}`;
    sub.style.cssText = `font-size: 13px; color: ${MUTED}; margin-bottom: 28px; max-width: 520px; line-height: 1.5;`;
    this.root.appendChild(sub);

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; max-width: 720px;';
    this.root.appendChild(row);

    REWARDS.forEach((reward, index) => {
      const btn = document.createElement('button');
      btn.innerHTML = `<div style="font-size:14px;letter-spacing:2px;font-weight:bold;margin-bottom:6px;">${reward.label}</div><div style="font-size:12px;color:${MUTED};">${reward.detail}</div>`;
      btn.style.cssText = `
        width: 200px; padding: 18px 12px; cursor: pointer; font-family: inherit; color: ${TEXT};
        background: ${PANEL_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px;
        transition: border-color 0.15s, box-shadow 0.15s;
      `;
      btn.onmouseenter = () => {
        btn.style.borderColor = ORANGE;
        btn.style.boxShadow = '0 0 16px rgba(255,158,27,0.35)';
      };
      btn.onmouseleave = () => {
        btn.style.borderColor = PANEL_BORDER;
        btn.style.boxShadow = 'none';
      };
      if (index === 0) btn.dataset.padDefault = '';
      btn.onclick = () => {
        this.hide();
        onChoose(reward.id);
      };
      row.appendChild(btn);
    });
  }

  hide() {
    this.root.innerHTML = '';
    this.root.style.cssText = 'display: none;';
    this.container.style.pointerEvents = 'none';
  }
}
