export interface RunStats {
  victory: boolean;
  timeSurvivedSec: number;
  totalKills: number;
  totalShotsFired: number;
  sectorReached: string;
}

/** DOM-based win/loss run summary shown at the end of a mission. */
export class ExtractionModal {
  private root: HTMLDivElement;

  constructor(private container: HTMLElement) {
    this.root = document.createElement('div');
    this.container.appendChild(this.root);
  }

  show(stats: RunStats, onRestart: () => void) {
    this.container.style.pointerEvents = 'auto';
    this.root.innerHTML = '';
    this.root.style.cssText = `
      position: absolute; inset: 0; background: rgba(5,5,8,0.95);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: 'Segoe UI', monospace; color: #EBF4FA; text-align: center;
    `;

    const title = document.createElement('h1');
    title.textContent = stats.victory ? 'EXTRACTION SUCCESSFUL' : 'MISSION FAILED';
    title.style.cssText = `font-size: 28px; letter-spacing: 4px; color: ${stats.victory ? '#00E676' : '#FF5252'}; margin-bottom: 20px;`;
    this.root.appendChild(title);

    const stat = (label: string, value: string) => {
      const row = document.createElement('div');
      row.style.cssText = 'font-size: 14px; margin: 4px 0; color: #8A94A6;';
      row.innerHTML = `${label}: <span style="color:#EBF4FA">${value}</span>`;
      this.root.appendChild(row);
    };

    stat('FURTHEST SECTOR', stats.sectorReached);
    stat('TIME SURVIVED', `${Math.round(stats.timeSurvivedSec)}s`);
    stat('ZOMBIES ELIMINATED', `${stats.totalKills}`);
    stat('SHOTS FIRED', `${stats.totalShotsFired}`);

    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'RETURN TO ARMORY';
    restartBtn.style.cssText = `
      margin-top: 26px; padding: 12px 40px; font-size: 14px; letter-spacing: 2px;
      background: #00E5FF; color: #05050A; border: none; cursor: pointer; font-weight: bold;
    `;
    restartBtn.onclick = () => {
      this.hide();
      onRestart();
    };
    this.root.appendChild(restartBtn);
  }

  hide() {
    this.root.innerHTML = '';
    // The root's own `inset: 0` backdrop has to go too, or it veils whatever is
    // shown next. See the matching note in ArmoryMenu.close().
    this.root.style.cssText = 'display: none;';
    this.container.style.pointerEvents = 'none';
  }
}
