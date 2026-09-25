import { WEAPON_REGISTRY, MUZZLE_MODIFIERS, RAIL_MODIFIERS, AMMO_MODIFIERS, MuzzleType, RailType, AmmoType } from '../config/weapons';
import { WeaponLoadout } from '../entities/Player';
import { CYAN, ORANGE, TEXT, MUTED, GREEN, RED, PANEL_BG, PANEL_BORDER, FIELD_BG } from './theme';
import { showQuitScreen } from './QuitScreen';
import { GameMode, loadArmoryState, saveArmoryState } from './LoadoutStorage';
import { Difficulty, DIFFICULTIES, DIFFICULTY_ORDER } from '../config/difficulty';
import { SECTOR_ALERT_SOUND_RADIUS_PX } from '../config/constants';
import { SessionManager } from '../net/SessionManager';
import { LobbyPanel } from './LobbyPanel';

export type { GameMode };

const MUZZLE_LABELS: Record<MuzzleType, string> = {
  none: 'No Attachment',
  suppressor: 'Titanium Suppressor',
  muzzle_brake: 'Muzzle Brake',
  compensator: 'Compensator',
  flash_hider: 'Flash Hider'
};

const RAIL_LABELS: Record<RailType, string> = {
  none: 'No Rail Attachment',
  flood_light: 'Flood Light',
  spotlight: 'Spotlight',
  green_laser: 'Green Laser',
  uv_blacklight: 'UV Blacklight'
};

const AMMO_LABELS: Record<AmmoType, string> = {
  standard: 'Standard Ball',
  subsonic: 'Subsonic',
  hollow_point: 'Hollow Point',
  armor_piercing: 'Armor Piercing'
};

/**
 * Pre-mission screen: picks the game mode (solo — a single operative, no
 * partner — or 2-player local) and weapon loadout(s), then deploys. In
 * 2-player mode a second set of tabs lets you configure Operative 2 too.
 */
export class ArmoryMenu {
  private root: HTMLDivElement;
  private resizeHandler: (() => void) | null = null;

  constructor(private container: HTMLElement) {
    this.root = document.createElement('div');
    this.container.appendChild(this.root);
  }

  open(
    onDeploy: (mode: GameMode, difficulty: Difficulty, p1: WeaponLoadout, p2: WeaponLoadout) => void,
    options: { session?: SessionManager | null; startOnline?: boolean; createHost?: boolean; joinCode?: string } = {}
  ) {
    const session = options.session ?? null;
    this.container.style.pointerEvents = 'auto';

    // Reopens on whatever mode and loadouts were last picked (see LoadoutStorage).
    const saved = loadArmoryState();
    const loadouts: [WeaponLoadout, WeaponLoadout] = saved.loadouts;
    let mode: GameMode = options.startOnline || session?.role === 'GUEST' ? 'online' : saved.mode;
    let difficulty: Difficulty = saved.difficulty;
    const mySlot: 0 | 1 = session?.role === 'GUEST' ? 1 : 0;
    let editingOperative: 0 | 1 = mode === 'online' ? mySlot : 0;
    let lobbyPanel: LobbyPanel | null = null;
    let broadcastTimer: ReturnType<typeof setTimeout> | null = null;

    this.root.innerHTML = '';
    this.root.style.cssText = `
      position: absolute; inset: 0; background: rgba(5,6,9,0.97);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Segoe UI', monospace; color: ${TEXT}; overflow: hidden;
    `;

    // Everything visible lives in `stage` so it can be scaled as one unit to
    // always fit the viewport (see fitStage below) instead of relying on
    // scroll, which used to clip the header/deploy button off-screen on
    // short windows.
    const stage = document.createElement('div');
    stage.style.cssText = 'display: flex; flex-direction: column; align-items: center; padding: 24px 20px;';
    this.root.appendChild(stage);

    // Recomputes stage's scale so its natural (untransformed) size always
    // fits inside the current viewport, live on every resize.
    const fitStage = () => {
      const availW = this.root.clientWidth - 24;
      const availH = this.root.clientHeight - 24;
      const naturalW = stage.offsetWidth;
      const naturalH = stage.offsetHeight;
      if (naturalW === 0 || naturalH === 0) return;
      const scale = Math.min(1, availW / naturalW, availH / naturalH);
      stage.style.transform = `scale(${scale})`;
    };
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    this.resizeHandler = fitStage;
    window.addEventListener('resize', this.resizeHandler);

    const quitBtn = document.createElement('button');
    quitBtn.textContent = 'QUIT GAME ✕';
    quitBtn.style.cssText = `
      position: absolute; top: 18px; right: 22px; background: none; border: 1px solid ${PANEL_BORDER};
      color: ${MUTED}; font-size: 12px; letter-spacing: 2px; padding: 8px 14px; cursor: pointer;
      font-family: inherit; border-radius: 3px;
    `;
    quitBtn.onmouseenter = () => { quitBtn.style.color = RED; quitBtn.style.borderColor = RED; };
    quitBtn.onmouseleave = () => { quitBtn.style.color = MUTED; quitBtn.style.borderColor = PANEL_BORDER; };
    quitBtn.onclick = () => showQuitScreen(this.root);
    this.root.appendChild(quitBtn);

    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; margin-bottom: 28px;';
    header.innerHTML = `
      <h1 style="margin:0; font-size: 44px; letter-spacing: 6px; font-weight: 800;">
        <span style="color:${TEXT}; text-shadow: 0 0 18px rgba(235,244,250,0.35);">HUSH</span><span style="color:${ORANGE}; text-shadow: 0 0 22px rgba(255,158,27,0.55);">FIRE</span>
      </h1>
      <div style="margin-top:8px; font-size:13px; letter-spacing:4px; color:${MUTED}; text-transform:uppercase;">
        Tactical Co-Op Extraction // Pre-Mission Armory
      </div>
    `;
    stage.appendChild(header);

    const layout = document.createElement('div');
    layout.style.cssText = 'display: flex; gap: 28px; flex-wrap: wrap; justify-content: center; max-width: 900px;';
    stage.appendChild(layout);

    // ---- Card 1: game mode & mission briefing ----
    const deployCard = this.buildCard('[ 1. MISSION BRIEFING ]', CYAN);
    layout.appendChild(deployCard.card);

    const modeLabel = document.createElement('div');
    modeLabel.textContent = 'GAME MODE:';
    modeLabel.style.cssText = `font-size: 12px; letter-spacing: 1px; color: ${MUTED}; margin-bottom: 8px;`;
    deployCard.body.appendChild(modeLabel);

    const modeRow = document.createElement('div');
    modeRow.style.cssText = 'display: flex; gap: 10px; margin-bottom: 18px;';
    deployCard.body.appendChild(modeRow);

    const modeButtonBase = `
      flex: 1; padding: 12px 8px; font-size: 13px; letter-spacing: 1px; font-family: inherit;
      border-radius: 4px; cursor: pointer; border: 1px solid;
    `;
    const soloBtn = this.buildModeButton('SOLO');
    const coopBtn = this.buildModeButton('LOCAL');
    const onlineBtn = this.buildModeButton('ONLINE');
    modeRow.appendChild(soloBtn);
    modeRow.appendChild(coopBtn);
    modeRow.appendChild(onlineBtn);

    // Difficulty: three buttons plus a one-line summary of the selected level.
    const diffLabel = document.createElement('div');
    diffLabel.textContent = 'DIFFICULTY:';
    diffLabel.style.cssText = `font-size: 12px; letter-spacing: 1px; color: ${MUTED}; margin-bottom: 8px;`;
    deployCard.body.appendChild(diffLabel);

    const diffRow = document.createElement('div');
    diffRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 6px;';
    deployCard.body.appendChild(diffRow);
    const diffBlurb = document.createElement('div');
    diffBlurb.style.cssText = `font-size: 11.5px; color: ${MUTED}; margin-bottom: 18px; min-height: 16px;`;
    deployCard.body.appendChild(diffBlurb);

    const diffButtons = DIFFICULTY_ORDER.map(level => {
      const btn = this.buildModeButton(DIFFICULTIES[level].label);
      btn.onclick = () => setDifficulty(level);
      diffRow.appendChild(btn);
      return { level, btn };
    });
    const setDifficulty = (next: Difficulty) => {
      difficulty = next;
      const active = `background: ${ORANGE}; color: #05050A; border-color: ${ORANGE}; font-weight: bold;`;
      const inactive = `background: ${FIELD_BG}; color: ${MUTED}; border-color: ${PANEL_BORDER}; font-weight: normal;`;
      for (const { level, btn } of diffButtons) btn.style.cssText = modeButtonBase + (level === difficulty ? active : inactive);
      diffBlurb.textContent = DIFFICULTIES[difficulty].blurb;
      saveArmoryState({ mode, difficulty, loadouts });
    };

    const operativeTabs = document.createElement('div');
    operativeTabs.style.cssText = 'display: none; gap: 8px; margin-bottom: 14px;';
    const op1Tab = this.buildOperativeTab('OPERATIVE 1');
    const op2Tab = this.buildOperativeTab('OPERATIVE 2');
    operativeTabs.appendChild(op1Tab);
    operativeTabs.appendChild(op2Tab);

    const loadoutBody = document.createElement('div');

    const operativeTabBase = `
      padding: 6px 14px; font-size: 11.5px; letter-spacing: 1px; font-family: inherit;
      border-radius: 3px; cursor: pointer; border: 1px solid;
    `;

    const setMode = (next: GameMode) => {
      mode = next;
      const active = `background: ${CYAN}; color: #05050A; border-color: ${CYAN}; font-weight: bold;`;
      const inactive = `background: ${FIELD_BG}; color: ${MUTED}; border-color: ${PANEL_BORDER}; font-weight: normal;`;
      soloBtn.style.cssText = modeButtonBase + (mode === 'solo' ? active : inactive);
      coopBtn.style.cssText = modeButtonBase + (mode === 'coop' ? active : inactive);
      onlineBtn.style.cssText = modeButtonBase + (mode === 'online' ? active : inactive);
      operativeTabs.style.display = mode === 'coop' || mode === 'online' ? 'flex' : 'none';
      if (mode === 'solo') editingOperative = 0;
      if (mode === 'online') editingOperative = mySlot;
      lobbyMount.style.display = mode === 'online' ? 'block' : 'none';
      readyBtn.style.display = mode === 'online' && session ? 'inline-block' : 'none';
      renderProtocol();
      renderLoadout();
      updateDeployButton();
    };
    soloBtn.onclick = () => setMode('solo');
    coopBtn.onclick = () => setMode('coop');
    onlineBtn.onclick = () => {
      if (session?.role === 'LOCAL') session.createHostSession().catch(() => updateDeployButton());
      setMode('online');
    };

    const setOperative = (index: 0 | 1) => {
      editingOperative = index;
      const active = `background: ${ORANGE}; color: #05050A; border-color: ${ORANGE};`;
      const inactive = `background: ${FIELD_BG}; color: ${MUTED}; border-color: ${PANEL_BORDER};`;
      op1Tab.style.cssText = operativeTabBase + (index === 0 ? active : inactive);
      op2Tab.style.cssText = operativeTabBase + (index === 1 ? active : inactive);
      renderLoadout();
    };
    op1Tab.onclick = () => setOperative(0);
    op2Tab.onclick = () => setOperative(1);

    const protocolBox = document.createElement('div');
    protocolBox.style.cssText = `background: ${PANEL_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px; padding: 14px 16px; margin-top: 4px;`;
    deployCard.body.appendChild(protocolBox);

    const lobbyMount = document.createElement('div');
    deployCard.body.appendChild(lobbyMount);

    const broadcastLoadout = () => {
      if (!session || mode !== 'online') return;
      if (broadcastTimer) clearTimeout(broadcastTimer);
      broadcastTimer = setTimeout(() => {
        session.broadcastLoadout(loadouts[mySlot], session.localReady);
      }, 120);
    };

    // The last tip depends on mode: solo has no partner to revive you — going
    // down there is an instant elimination (see Game.ts's handleZombieContact).
    const renderProtocol = () => {
      const lastTip =
        mode === 'solo'
          ? 'Going down alone is fatal — with no partner to revive you, it means instant elimination.'
          : 'Downed partners can be revived by standing nearby!';
      protocolBox.innerHTML = `
        <div style="color:${ORANGE}; font-size:12px; letter-spacing:1px; font-weight:bold; margin-bottom:9px;">SURVIVAL PROTOCOL:</div>
        <ul style="margin:0; padding-left:18px; color:${TEXT}; font-size:13.5px; line-height:1.8;">
          <li>Move through dark sectors to reach the Evac Point.</li>
          <li>Flashlights reveal the dark, but a direct beam on sleeping lurkers alerts them!</li>
          <li>Suppressed shots allow stealth kills. Unsilenced guns cause sector horde frenzies.</li>
          <li>${lastTip}</li>
        </ul>
      `;
    };

    // ---- Card 2: weapon loadout ----
    const loadoutCard = this.buildCard('[ 2. WEAPON LOADOUT & ATTACHMENTS ]', ORANGE);
    loadoutCard.card.style.width = '380px';
    loadoutCard.body.appendChild(operativeTabs);
    loadoutCard.body.appendChild(loadoutBody);
    layout.appendChild(loadoutCard.card);

    // Every attachment is mounted per-weapon now — each row below is a
    // primary/secondary pair rather than one shared choice, so swapping
    // weapons genuinely swaps your muzzle, sight, and chambered ammo too.
    const pairedRow = (
      leftLabel: string,
      rightLabel: string,
      leftOptions: [string, string][],
      rightOptions: [string, string][],
      leftValue: string,
      rightValue: string,
      onLeftChange: (v: string) => void,
      onRightChange: (v: string) => void
    ): HTMLDivElement => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; gap: 16px; margin-bottom: 16px;';
      row.appendChild(this.buildSelect(leftLabel, leftOptions, leftValue, onLeftChange));
      row.appendChild(this.buildSelect(rightLabel, rightOptions, rightValue, onRightChange));
      return row;
    };

    const renderLoadout = () => {
      loadoutBody.innerHTML = '';
      const loadout = loadouts[editingOperative];

      loadoutBody.appendChild(
        pairedRow(
          'PRIMARY WEAPON:',
          'SECONDARY WEAPON:',
          Object.values(WEAPON_REGISTRY)
            .filter(w => w.type === 'primary')
            .map(w => [w.id, w.name] as [string, string]),
          Object.values(WEAPON_REGISTRY)
            .filter(w => w.type === 'secondary')
            .map(w => [w.id, w.name] as [string, string]),
          loadout.primaryWeapon,
          loadout.secondaryWeapon,
          v => {
            loadout.primaryWeapon = v;
            renderLoadout();
          },
          v => {
            loadout.secondaryWeapon = v;
            renderLoadout();
          }
        )
      );

      const muzzleOptions: [string, string][] = Object.keys(MUZZLE_MODIFIERS).map(k => {
        const mult = MUZZLE_MODIFIERS[k as MuzzleType].soundMult;
        const pct = Math.round((mult - 1) * 100);
        const tag = pct === 0 ? '' : ` (${pct > 0 ? '+' : ''}${pct}% Sound)`;
        return [k, `${MUZZLE_LABELS[k as MuzzleType]}${tag}`];
      });
      loadoutBody.appendChild(
        pairedRow(
          'PRIMARY MUZZLE:',
          'SECONDARY MUZZLE:',
          muzzleOptions,
          muzzleOptions,
          loadout.primaryMuzzle,
          loadout.secondaryMuzzle,
          v => {
            loadout.primaryMuzzle = v as MuzzleType;
            renderLoadout();
          },
          v => {
            loadout.secondaryMuzzle = v as MuzzleType;
            renderLoadout();
          }
        )
      );

      const railOptions: [string, string][] = Object.keys(RAIL_MODIFIERS).map(k => {
        const rail = RAIL_MODIFIERS[k as RailType];
        const deg = Math.round((rail.coneAngleRad * 180) / Math.PI);
        const beam = k === 'none' ? '' : k === 'green_laser' ? ' (Pinpoint Beam)' : ` (${deg}° Beam)`;
        return [k, `${RAIL_LABELS[k as RailType]}${beam}`];
      });
      loadoutBody.appendChild(
        pairedRow(
          'PRIMARY RAIL/SIGHT:',
          'SECONDARY RAIL/SIGHT:',
          railOptions,
          railOptions,
          loadout.primaryRail,
          loadout.secondaryRail,
          v => {
            loadout.primaryRail = v as RailType;
            renderLoadout();
          },
          v => {
            loadout.secondaryRail = v as RailType;
            renderLoadout();
          }
        )
      );

      const ammoOptions: [string, string][] = Object.keys(AMMO_MODIFIERS).map(k => [k, AMMO_LABELS[k as AmmoType]]);
      loadoutBody.appendChild(
        pairedRow(
          'PRIMARY AMMO TYPE:',
          'SECONDARY AMMO TYPE:',
          ammoOptions,
          ammoOptions,
          loadout.primaryAmmoType,
          loadout.secondaryAmmoType,
          v => {
            loadout.primaryAmmoType = v as AmmoType;
            renderLoadout();
          },
          v => {
            loadout.secondaryAmmoType = v as AmmoType;
            renderLoadout();
          }
        )
      );

      loadoutBody.appendChild(this.buildStatsPanel(loadout));
      loadoutBody.querySelectorAll('select').forEach(el => {
        if (mode === 'online' && editingOperative !== mySlot) (el as HTMLSelectElement).disabled = true;
      });
      broadcastLoadout();
      // Every loadout or mode change ends up here, so this is the one place to persist.
      saveArmoryState({ mode: mode === 'online' ? 'coop' : mode, difficulty, loadouts });
      // Loadout swaps can change this card's height (e.g. hidden vs. shown
      // operative tabs), so re-fit on every re-render, not just on resize.
      fitStage();
    };

    setDifficulty(difficulty);
    setMode(mode);
    setOperative(0);

    const updateDeployButton = () => {
      const online = mode === 'online' && session;
      if (!online) {
        deployBtn.textContent = 'DEPLOY TO SECTOR 1';
        deployBtn.disabled = false;
        deployBtn.style.opacity = '1';
        return;
      }
      const bothReady = session.localReady && session.partnerReady && session.isConnected;
      if (session.role === 'HOST') {
        deployBtn.textContent = bothReady ? 'DEPLOY TO SECTOR 1' : 'WAITING FOR PARTNER';
        deployBtn.disabled = !bothReady;
      } else {
        deployBtn.textContent = session.localReady ? 'WAITING FOR HOST' : 'NOT READY';
        deployBtn.disabled = true;
      }
      deployBtn.style.opacity = deployBtn.disabled ? '0.65' : '1';
    };

    const readyBtn = document.createElement('button');
    readyBtn.textContent = 'READY';
    readyBtn.style.cssText = `
      margin-top: 22px; padding: 10px 28px; font-size: 13px; letter-spacing: 2px; font-weight: bold;
      background: ${FIELD_BG}; color: ${CYAN}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px;
      cursor: pointer; font-family: inherit; display: none;
    `;
    readyBtn.onclick = () => {
      if (!session) return;
      session.localReady = !session.localReady;
      readyBtn.textContent = session.localReady ? 'UNREADY' : 'READY';
      session.broadcastLoadout(loadouts[mySlot], session.localReady);
      updateDeployButton();
    };

    // ---- Deploy ----
    const deployBtn = document.createElement('button');
    deployBtn.textContent = 'DEPLOY TO SECTOR 1';
    deployBtn.style.cssText = `
      margin-top: 12px; padding: 16px 56px; font-size: 16px; letter-spacing: 3px; font-weight: bold;
      background: linear-gradient(180deg, #FFB23E, ${ORANGE}); color: #1A0D00; border: none; border-radius: 4px;
      cursor: pointer; font-family: inherit; box-shadow: 0 0 24px rgba(255,158,27,0.45);
    `;
    deployBtn.dataset.padDefault = '';
    deployBtn.onclick = () => {
      if (mode === 'online' && session) {
        if (session.role !== 'HOST' || deployBtn.disabled) return;
        const seed = Math.floor(Math.random() * 0xffffffff);
        session.hostDeploy(seed, loadouts[0], session.partnerLoadout ?? loadouts[1]);
        return;
      }
      this.close();
      onDeploy(mode, difficulty, loadouts[0], loadouts[1]);
    };
    stage.appendChild(readyBtn);
    stage.appendChild(deployBtn);

    if (session) {
      lobbyPanel = new LobbyPanel(session);
      lobbyPanel.mount(lobbyMount);
      readyBtn.style.display = 'inline-block';
      session.onStateChange = () => {
        updateDeployButton();
        if (session.partnerLoadout) {
          loadouts[mySlot === 0 ? 1 : 0] = session.partnerLoadout;
          if (editingOperative !== mySlot) renderLoadout();
        }
      };
      session.onMessage = msg => {
        if (msg.t === 'loadout') {
          loadouts[mySlot === 0 ? 1 : 0] = msg.loadout;
          if (editingOperative !== mySlot) renderLoadout();
          updateDeployButton();
        }
      };
      session.onDeploy = (_seed, hostLoadout, guestLoadout) => {
        this.close();
        const own = session.role === 'HOST' ? hostLoadout : guestLoadout;
        const partner = session.role === 'HOST' ? guestLoadout : hostLoadout;
        onDeploy('online', difficulty, own, partner);
      };
      if (options.createHost && session.role === 'LOCAL') {
        session.createHostSession().catch(() => updateDeployButton());
      } else if (options.joinCode) {
        session.joinSession(options.joinCode);
      } else if (session.role === 'GUEST') {
        session.joinSession(session.roomCode);
      }
    }

    fitStage();
    updateDeployButton();
  }

  private buildCard(label: string, accent: string): { card: HTMLDivElement; body: HTMLDivElement } {
    const card = document.createElement('div');
    card.style.cssText = `background: ${PANEL_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 6px; padding: 22px; width: 320px; box-shadow: 0 8px 30px rgba(0,0,0,0.4);`;

    const heading = document.createElement('div');
    heading.textContent = label;
    heading.style.cssText = `color: ${accent}; font-size: 13px; letter-spacing: 1px; font-weight: bold; margin-bottom: 10px;`;
    card.appendChild(heading);

    const divider = document.createElement('div');
    divider.style.cssText = `height: 1px; background: ${PANEL_BORDER}; margin-bottom: 16px;`;
    card.appendChild(divider);

    const body = document.createElement('div');
    card.appendChild(body);

    return { card, body };
  }

  private buildModeButton(label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      flex: 1; padding: 12px 8px; font-size: 12px; letter-spacing: 1px; font-family: inherit;
      border: 1px solid ${PANEL_BORDER}; border-radius: 4px; cursor: pointer;
    `;
    return btn;
  }

  private buildOperativeTab(label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      padding: 6px 14px; font-size: 10.5px; letter-spacing: 1px; font-family: inherit;
      border: 1px solid ${PANEL_BORDER}; border-radius: 3px; cursor: pointer; background: ${FIELD_BG}; color: ${MUTED};
    `;
    return btn;
  }

  private buildSelect(label: string, options: [string, string][], current: string, onChange: (value: string) => void, fullWidth = false): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = fullWidth ? 'margin-bottom: 16px;' : 'flex: 1; min-width: 0;';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.cssText = `display: block; font-size: 11.5px; color: ${MUTED}; margin-bottom: 6px; letter-spacing: 1px;`;
    wrap.appendChild(lbl);

    const selectWrap = document.createElement('div');
    selectWrap.style.cssText = 'position: relative;';

    const select = document.createElement('select');
    select.style.cssText = `
      width: 100%; padding: 9px 26px 9px 10px; background: ${FIELD_BG}; color: ${TEXT};
      border: 1px solid ${PANEL_BORDER}; border-radius: 3px; font-family: inherit; font-size: 13.5px;
      appearance: none; cursor: pointer;
    `;
    for (const [value, text] of options) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      if (value === current) opt.selected = true;
      select.appendChild(opt);
    }
    select.onchange = () => onChange(select.value);
    selectWrap.appendChild(select);

    const chevron = document.createElement('span');
    chevron.textContent = '▾';
    chevron.style.cssText = `position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: ${MUTED}; pointer-events: none; font-size: 11px;`;
    selectWrap.appendChild(chevron);

    wrap.appendChild(selectWrap);
    return wrap;
  }

  private buildStatsPanel(loadout: WeaponLoadout): HTMLDivElement {
    const box = document.createElement('div');
    box.style.cssText = `background: ${PANEL_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px; padding: 14px 16px; margin-top: 4px;`;

    const row = (label: string, value: string, color: string) => `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; padding:5px 0; color:${MUTED};">
        <span>${label}:</span><span style="color:${color}; font-weight:bold;">${value}</span>
      </div>
    `;

    const heading = (label: string) => `
      <div style="font-size:11.5px; letter-spacing:1px; color:${ORANGE}; font-weight:bold; margin:${label === 'PRIMARY' ? '0' : '10px'} 0 4px;">${label}</div>
    `;

    // Each weapon's stats reflect that slot's own muzzle/ammo choice now, since both
    // are per-weapon — the primary and secondary can genuinely perform differently.
    const stats = (weaponId: string, muzzle: MuzzleType, ammoType: AmmoType) => {
      const weapon = WEAPON_REGISTRY[weaponId];
      const muzzleMod = MUZZLE_MODIFIERS[muzzle];
      const ammoMod = AMMO_MODIFIERS[ammoType];
      const damage = Math.round(weapon.baseDamage * muzzleMod.dmgMult * ammoMod.dmgMult);
      const soundRadius = Math.round(weapon.baseSoundRadiusPx * muzzleMod.soundMult * ammoMod.soundMult);
      const stealthy = soundRadius <= SECTOR_ALERT_SOUND_RADIUS_PX;

      return (
        row('EFFECTIVE DAMAGE', `${damage} DMG / shot`, TEXT) +
        row('ACOUSTIC SOUND RADIUS', `${soundRadius} px (${stealthy ? 'STEALTH READY' : 'WILL ALERT SECTOR'})`, stealthy ? GREEN : RED) +
        row('MAGAZINE CAPACITY', weapon.infiniteAmmo ? `MELEE — NO AMMO (${weapon.fireRateRPM} SWINGS/MIN)` : `${weapon.magSize} ROUNDS (${weapon.fireRateRPM} RPM)`, CYAN)
      );
    };

    box.innerHTML =
      heading('PRIMARY') +
      stats(loadout.primaryWeapon, loadout.primaryMuzzle, loadout.primaryAmmoType) +
      heading('SECONDARY') +
      stats(loadout.secondaryWeapon, loadout.secondaryMuzzle, loadout.secondaryAmmoType);

    return box;
  }

  close() {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.root.innerHTML = '';
    // Emptying the panel is not enough: the root itself carries `inset: 0` and a
    // near-opaque backdrop, so leaving the style behind veils the whole game in
    // near-black — the sector renders correctly and looks pitch dark anyway.
    this.root.style.cssText = 'display: none;';
    this.container.style.pointerEvents = 'none';
  }
}
