import {
  WEAPON_REGISTRY,
  MUZZLE_MODIFIERS,
  MUZZLE_ARMORY_ORDER,
  RAIL_MODIFIERS,
  AMMO_MODIFIERS,
  MuzzleType,
  RailType,
  AmmoType,
  PRIMARY_WEAPON_ARMORY_ORDER,
  SECONDARY_WEAPON_ARMORY_ORDER,
  MELEE_WEAPON_ARMORY_ORDER
} from '../config/weapons';
import { OPERATIVE_GEAR_ORDER, OPERATIVE_GEAR_REGISTRY, OperativeGearId } from '../config/operativeGear';
import { GRENADE_POUCH_STARTING, THROWABLE_LABELS, THROWABLE_ORDER } from '../config/throwables';
import { DEFAULT_THROWABLE_CARRY } from '../config/throwableCarry';
import { isThrowableUnlocked, throwableUnlockHint } from './WeaponUnlocks';
import { WeaponLoadout } from '../entities/Player';
import { CYAN, ORANGE, TEXT, MUTED, GREEN, RED, PANEL_BG, PANEL_BORDER, FIELD_BG } from './theme';
import { loadPlayerProfile } from './PlayerProfile';
import { levelProgressFromTotalXp } from './PlayerProgress';
import { GRADE_COLOR } from './LetterGrade';
import { showQuitScreen } from './QuitScreen';
import { GameMode, loadArmoryState, saveArmoryState } from './LoadoutStorage';
import { Difficulty, DIFFICULTIES, DIFFICULTY_ORDER } from '../config/difficulty';
import { SECTOR_ALERT_SOUND_RADIUS_PX } from '../config/constants';
import { getSectorModifier, SectorModifierId, SECTOR_MODIFIER_ORDER, SECTOR_MODIFIERS } from '../config/sectorModifiers';
import { SessionManager } from '../net/SessionManager';
import { LobbyPanel } from './LobbyPanel';
import {
  gearUnlockHint,
  isGearUnlocked,
  isMuzzleUnlocked,
  isWeaponUnlocked,
  muzzleUnlockHint,
  weaponUnlockHint
} from './WeaponUnlocks';

export type { GameMode };

const MUZZLE_LABELS: Record<MuzzleType, string> = {
  none: 'No Attachment',
  tactical_suppressor: 'Tactical Suppressor',
  titanium_suppressor: 'Titanium Suppressor',
  monolithic_suppressor: 'Monolithic Suppressor',
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
 * Pre-mission screen: solo or online co-op, plus weapon loadout(s). Online
 * mode locks host to Operative 1 and guest to Operative 2 — no switching.
 */
export class ArmoryMenu {
  private root: HTMLDivElement;
  private resizeHandler: (() => void) | null = null;

  constructor(private container: HTMLElement) {
    this.root = document.createElement('div');
    this.container.appendChild(this.root);
  }

  open(
    onDeploy: (
      mode: GameMode,
      difficulty: Difficulty,
      p1: WeaponLoadout,
      p2: WeaponLoadout,
      runModifier: SectorModifierId,
      net?: { seed: number; role: 'host' | 'guest' }
    ) => void,
    options: {
      session?: SessionManager | null;
      startOnline?: boolean;
      createHost?: boolean;
      joinCode?: string;
      /** Set for daily runs: the day's twist, not rerollable. */
      fixedModifier?: SectorModifierId;
      onBack?: () => void;
    } = {}
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
    // Daily runs lock the day's twist (derived from the UTC seed) so every
    // player faces the same run; campaign/survival roll one, rerollable below.
    const fixedModifier = options.fixedModifier;
    let runModifier: SectorModifierId = fixedModifier ?? saved.runModifier ?? 'none';

    const persistArmory = () => {
      saveArmoryState({
        mode,
        difficulty,
        loadouts,
        runModifier: fixedModifier ? saved.runModifier : runModifier
      });
    };
    let lobbyPanel: LobbyPanel | null = null;
    let broadcastTimer: ReturnType<typeof setTimeout> | null = null;

    this.root.innerHTML = '';
    this.root.style.cssText = `
      position: absolute; inset: 0; background: rgba(5,6,9,0.97);
      display: flex; flex-direction: column;
      font-family: 'Segoe UI', monospace; color: ${TEXT}; overflow: hidden;
    `;

    const stageShell = document.createElement('div');
    stageShell.style.cssText = `
      flex: 1; min-height: 0; width: 100%; overflow: auto; box-sizing: border-box;
      display: flex; justify-content: flex-start; align-items: flex-start;
      padding: 52px 28px 10px 24px;
    `;
    const stage = document.createElement('div');
    stage.style.cssText = `
      width: 100%; display: flex; flex-direction: column; transform-origin: top left;
      flex-shrink: 0;
    `;
    stageShell.appendChild(stage);
    this.root.appendChild(stageShell);

    const fitStage = () => {
      requestAnimationFrame(() => {
        stage.style.transform = 'none';
        const availW = stageShell.clientWidth;
        const availH = stageShell.clientHeight;
        const naturalW = stage.offsetWidth;
        const naturalH = stage.offsetHeight;
        if (!naturalW || !naturalH) return;
        const scale = Math.min(1, availW / naturalW, availH / naturalH);
        stage.style.transform = `scale(${scale})`;
        // Transformed layout still uses pre-scale box size — reserve vertical space so
        // loadout columns (grenade pouch, stats) are not clipped by overflow:hidden.
        stage.style.marginBottom = `${Math.max(0, naturalH * (scale - 1))}px`;
      });
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

    if (options.onBack) {
      const backBtn = document.createElement('button');
      backBtn.textContent = '← BACK TO MAIN MENU';
      backBtn.style.cssText = `
        position: absolute; top: 18px; left: 22px; background: none; border: 1px solid ${PANEL_BORDER};
        color: ${MUTED}; font-size: 12px; letter-spacing: 2px; padding: 8px 14px; cursor: pointer;
        font-family: inherit; border-radius: 3px;
      `;
      backBtn.onmouseenter = () => { backBtn.style.color = CYAN; backBtn.style.borderColor = CYAN; };
      backBtn.onmouseleave = () => { backBtn.style.color = MUTED; backBtn.style.borderColor = PANEL_BORDER; };
      backBtn.onclick = () => {
        this.close();
        options.onBack?.();
      };
      this.root.appendChild(backBtn);
    }

    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; margin-bottom: 12px; flex-shrink: 0; width: 100%;';
    header.innerHTML = `
      <h1 style="margin:0; font-size: clamp(28px, 4vw, 44px); letter-spacing: 6px; font-weight: 800;">
        <span style="color:${TEXT}; text-shadow: 0 0 18px rgba(235,244,250,0.35);">HUSH</span><span style="color:${ORANGE}; text-shadow: 0 0 22px rgba(255,158,27,0.55);">FIRE</span>
      </h1>
      <div style="margin-top:8px; font-size:13px; letter-spacing:4px; color:${MUTED}; text-transform:uppercase;">
        Tactical Co-Op Extraction // Pre-Mission Armory
      </div>
    `;
    stage.appendChild(header);
    stage.style.maxWidth = '1120px';
    stage.style.margin = '0';
    stage.style.width = '100%';

    type ArmoryTab = 'briefing' | 'loadout' | 'profile';
    let activeTab: ArmoryTab = 'briefing';

    const shell = document.createElement('div');
    shell.id = 'armory-layout';
    shell.style.cssText = `
      display: flex; width: 100%; max-width: 100%; margin: 0; align-items: flex-start;
      justify-content: flex-start; min-height: 320px;
    `;
    stage.appendChild(shell);

    const tabNav = document.createElement('div');
    tabNav.style.cssText = `
      display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; width: 200px;
      align-items: stretch; align-self: flex-start; position: sticky; top: 0;
      padding: 0 16px 0 0; margin: 0; border-right: 1px solid ${PANEL_BORDER};
      box-sizing: border-box;
    `;
    shell.appendChild(tabNav);

    const contentPanel = document.createElement('div');
    contentPanel.style.cssText = `
      flex: 1; min-width: 0; background: ${PANEL_BG}; border: 1px solid ${PANEL_BORDER};
      border-radius: 6px; padding: 18px 20px; box-sizing: border-box;
      box-shadow: 0 8px 30px rgba(0,0,0,0.4); text-align: left;
    `;
    shell.appendChild(contentPanel);

    const briefingPane = document.createElement('div');
    const loadoutPane = document.createElement('div');
    const profilePane = document.createElement('div');
    loadoutPane.style.cssText = 'max-height: min(68vh, 560px); overflow-y: auto; overflow-x: hidden;';
    loadoutPane.style.display = 'none';
    profilePane.style.display = 'none';
    contentPanel.appendChild(briefingPane);
    contentPanel.appendChild(loadoutPane);
    contentPanel.appendChild(profilePane);

    const tabButtonBase = `
      display: block; width: 100%; box-sizing: border-box; text-align: left; padding: 14px 10px;
      font-size: 11.5px; letter-spacing: 1px; font-family: inherit; border-radius: 4px;
      cursor: pointer; border: 1px solid; line-height: 1.35; margin: 0;
    `;
    const briefingTabBtn = document.createElement('button');
    briefingTabBtn.type = 'button';
    briefingTabBtn.textContent = 'MISSION BRIEFING';
    const loadoutTabBtn = document.createElement('button');
    loadoutTabBtn.type = 'button';
    loadoutTabBtn.innerHTML = 'WEAPON LOADOUT<br>& ATTACHMENTS';
    const profileTabBtn = document.createElement('button');
    profileTabBtn.type = 'button';
    profileTabBtn.textContent = 'PLAYER PROFILE';
    tabNav.appendChild(briefingTabBtn);
    tabNav.appendChild(loadoutTabBtn);
    tabNav.appendChild(profileTabBtn);

    const renderProfile = () => {
      profilePane.innerHTML = '';
      profilePane.appendChild(this.buildPlayerProfilePanel());
    };

    const applyTabStyles = () => {
      const pick = (active: boolean, accent: string) =>
        tabButtonBase +
        (active
          ? `background: ${accent}; color: #05050A; border-color: ${accent}; font-weight: bold;`
          : `background: ${FIELD_BG}; color: ${MUTED}; border-color: ${PANEL_BORDER}; font-weight: normal;`);
      briefingTabBtn.style.cssText = pick(activeTab === 'briefing', CYAN);
      loadoutTabBtn.style.cssText = pick(activeTab === 'loadout', ORANGE);
      profileTabBtn.style.cssText = pick(activeTab === 'profile', GREEN);
      briefingPane.style.display = activeTab === 'briefing' ? 'block' : 'none';
      loadoutPane.style.display = activeTab === 'loadout' ? 'block' : 'none';
      profilePane.style.display = activeTab === 'profile' ? 'block' : 'none';
      if (activeTab === 'profile') renderProfile();
      fitStage();
    };
    briefingTabBtn.onclick = () => {
      activeTab = 'briefing';
      applyTabStyles();
    };
    loadoutTabBtn.onclick = () => {
      activeTab = 'loadout';
      if (typeof renderLoadoutRef === 'function') renderLoadoutRef();
      applyTabStyles();
    };
    profileTabBtn.onclick = () => {
      activeTab = 'profile';
      applyTabStyles();
    };
    applyTabStyles();

    // ---- Mission briefing tab ----
    const modeLabel = document.createElement('div');
    modeLabel.textContent = 'GAME MODE:';
    modeLabel.style.cssText = `font-size: 12px; letter-spacing: 1px; color: ${MUTED}; margin-bottom: 8px;`;
    briefingPane.appendChild(modeLabel);

    const modeRow = document.createElement('div');
    modeRow.style.cssText = 'display: flex; gap: 10px; margin-bottom: 18px;';
    briefingPane.appendChild(modeRow);

    const modeButtonBase = `
      flex: 1; padding: 12px 8px; font-size: 13px; letter-spacing: 1px; font-family: inherit;
      border-radius: 4px; cursor: pointer; border: 1px solid;
    `;
    const soloBtn = this.buildModeButton('SOLO');
    const onlineBtn = this.buildModeButton('ONLINE');
    modeRow.appendChild(soloBtn);
    modeRow.appendChild(onlineBtn);

    // Difficulty: three buttons plus a one-line summary of the selected level.
    const diffLabel = document.createElement('div');
    diffLabel.textContent = 'DIFFICULTY:';
    diffLabel.style.cssText = `font-size: 12px; letter-spacing: 1px; color: ${MUTED}; margin-bottom: 8px;`;
    briefingPane.appendChild(diffLabel);

    const diffRow = document.createElement('div');
    diffRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 6px;';
    briefingPane.appendChild(diffRow);
    const diffBlurb = document.createElement('div');
    diffBlurb.style.cssText = `font-size: 11.5px; color: ${MUTED}; margin-bottom: 18px; min-height: 16px;`;
    briefingPane.appendChild(diffBlurb);

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
      persistArmory();
    };

    /** Online co-op: fixed slot per role — host = Op 1, guest = Op 2, no switching. */
    const operativeSlotLabel = document.createElement('div');
    operativeSlotLabel.style.cssText = `
      display: none; margin-bottom: 14px; padding: 10px 14px; font-size: 12px; letter-spacing: 1px;
      color: ${ORANGE}; font-weight: bold; border: 1px solid ${PANEL_BORDER}; border-radius: 3px;
      text-align: center; background: ${FIELD_BG};
    `;

    const loadoutBody = document.createElement('div');

    const applyOnlineOperativeSlot = () => {
      if (mode !== 'online') {
        operativeSlotLabel.style.display = 'none';
        editingOperative = 0;
        return;
      }
      editingOperative = mySlot;
      operativeSlotLabel.style.display = 'block';
      operativeSlotLabel.textContent =
        mySlot === 0
          ? 'YOUR OPERATIVE: OPERATIVE 1 (HOST) — LOCKED'
          : 'YOUR OPERATIVE: OPERATIVE 2 (GUEST) — LOCKED';
    };

    const setMode = (next: GameMode) => {
      mode = next;
      const active = `background: ${CYAN}; color: #05050A; border-color: ${CYAN}; font-weight: bold;`;
      const inactive = `background: ${FIELD_BG}; color: ${MUTED}; border-color: ${PANEL_BORDER}; font-weight: normal;`;
      soloBtn.style.cssText = modeButtonBase + (mode === 'solo' ? active : inactive);
      onlineBtn.style.cssText = modeButtonBase + (mode === 'online' ? active : inactive);
      applyOnlineOperativeSlot();
      lobbyMount.style.display = mode === 'online' ? 'block' : 'none';
      readyBtn.style.display =
        mode === 'online' && session && session.role !== 'LOCAL' ? 'inline-block' : 'none';
      renderProtocol();
      renderLoadout();
      updateDeployButton();
      fitStage();
    };
    soloBtn.onclick = () => setMode('solo');
    onlineBtn.onclick = () => {
      if (session?.role === 'LOCAL') session.createHostSession().catch(() => updateDeployButton());
      setMode('online');
    };

    const protocolBox = document.createElement('div');
    protocolBox.style.cssText = `background: ${FIELD_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px; padding: 14px 16px; margin-top: 4px;`;
    briefingPane.appendChild(protocolBox);

    const modifierMount = document.createElement('div');
    modifierMount.style.cssText = 'margin-bottom: 10px;';
    const protocolText = document.createElement('div');
    protocolBox.appendChild(modifierMount);
    protocolBox.appendChild(protocolText);

    const modifierOptions = (): [string, string][] =>
      SECTOR_MODIFIER_ORDER.map(id => [id, SECTOR_MODIFIERS[id].name]);

    const renderModifierSelect = () => {
      modifierMount.innerHTML = '';
      const label = fixedModifier ? 'RUN MODIFIER (FIXED TODAY):' : 'RUN MODIFIER:';
      const select = this.buildSelect(
        label,
        modifierOptions(),
        runModifier,
        v => {
          if (fixedModifier) return;
          runModifier = v as SectorModifierId;
          renderProtocol();
          persistArmory();
        },
        true,
        () => true
      );
      if (fixedModifier) {
        const el = select.querySelector('select');
        if (el) el.disabled = true;
      }
      modifierMount.appendChild(select);
    };

    const lobbyMount = document.createElement('div');
    briefingPane.appendChild(lobbyMount);

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
      const mod = getSectorModifier(runModifier);
      renderModifierSelect();
      protocolText.innerHTML = `
        <div style="color:${ORANGE}; font-size:12px; letter-spacing:1px; font-weight:bold; margin-bottom:9px;">SURVIVAL PROTOCOL:</div>
        <div style="background:${FIELD_BG}; border:1px solid ${PANEL_BORDER}; border-radius:4px; padding:10px 12px; margin-bottom:10px;">
          <div style="color:${MUTED}; font-size:12px; line-height:1.5;">${mod.blurb}</div>
        </div>
        <ul style="margin:0; padding-left:18px; color:${TEXT}; font-size:13px; line-height:1.55;">
          <li>Move through dark sectors to reach the Evac Point.</li>
          <li>Flashlights reveal the dark, but a direct beam on sleeping lurkers alerts them!</li>
          <li>Suppressed shots allow stealth kills. Unsilenced guns cause sector horde frenzies.</li>
          <li>${lastTip}</li>
        </ul>
      `;
      fitStage();
    };

    // ---- Weapon loadout tab ----
    const loadoutLayout = document.createElement('div');
    loadoutLayout.style.cssText =
      'display: flex; gap: 18px; align-items: flex-start; width: 100%; box-sizing: border-box;';
    loadoutBody.style.cssText = 'flex: 1; min-width: 0;';
    const statsMount = document.createElement('div');
    statsMount.style.cssText =
      'flex: 0 0 38%; max-width: 400px; min-width: 268px; position: sticky; top: 8px; align-self: flex-start;';
    loadoutLayout.appendChild(loadoutBody);
    loadoutLayout.appendChild(statsMount);
    loadoutPane.style.textAlign = 'left';
    loadoutPane.appendChild(operativeSlotLabel);
    loadoutPane.appendChild(loadoutLayout);

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
      row.style.cssText = 'display: flex; gap: 14px; margin-bottom: 12px;';
      row.appendChild(this.buildSelect(leftLabel, leftOptions, leftValue, onLeftChange));
      row.appendChild(this.buildSelect(rightLabel, rightOptions, rightValue, onRightChange));
      return row;
    };

    const weaponOptions = (type: 'primary' | 'secondary' | 'melee'): [string, string][] => {
      const order =
        type === 'primary'
          ? PRIMARY_WEAPON_ARMORY_ORDER
          : type === 'secondary'
            ? SECONDARY_WEAPON_ARMORY_ORDER
            : MELEE_WEAPON_ARMORY_ORDER;
      return order
        .filter(id => WEAPON_REGISTRY[id]?.type === type)
        .map(id => {
          const w = WEAPON_REGISTRY[id];
          const locked = !isWeaponUnlocked(id);
          const tag = locked ? ` 🔒 (${weaponUnlockHint(id)})` : '';
          return [id, w.name + tag] as [string, string];
        });
    };

    const gearOptions = (): [string, string][] =>
      OPERATIVE_GEAR_ORDER.map(id => {
        const g = OPERATIVE_GEAR_REGISTRY[id];
        const locked = !isGearUnlocked(id);
        const tag = locked && id !== 'none' ? ` 🔒 (${gearUnlockHint(id)})` : '';
        return [id, g.name + tag] as [string, string];
      });

    let renderLoadoutRef: (() => void) | null = null;
    const renderLoadout = () => {
      if (mode === 'online') editingOperative = mySlot;
      loadoutBody.innerHTML = '';
      const loadout = loadouts[editingOperative];

      loadoutBody.appendChild(
        pairedRow(
          'PRIMARY WEAPON:',
          'SECONDARY WEAPON:',
          weaponOptions('primary'),
          weaponOptions('secondary'),
          loadout.primaryWeapon,
          loadout.secondaryWeapon,
          v => {
            if (!isWeaponUnlocked(v)) return;
            loadout.primaryWeapon = v;
            renderLoadout();
          },
          v => {
            if (!isWeaponUnlocked(v)) return;
            loadout.secondaryWeapon = v;
            renderLoadout();
          }
        )
      );

      if (!loadout.throwableCarry) loadout.throwableCarry = { ...DEFAULT_THROWABLE_CARRY };
      const carry = loadout.throwableCarry;
      const anyGrenadeCarried = THROWABLE_ORDER.some(k => carry[k]);

      const meleeGrenadeRow = document.createElement('div');
      meleeGrenadeRow.style.cssText = 'display: flex; gap: 14px; margin-bottom: 12px; align-items: flex-start;';

      const meleeCol = document.createElement('div');
      meleeCol.style.cssText = 'flex: 1; min-width: 0;';
      meleeCol.appendChild(
        this.buildSelect(
          'MELEE WEAPON:',
          weaponOptions('melee'),
          loadout.meleeWeapon,
          v => {
            if (!isWeaponUnlocked(v)) return;
            loadout.meleeWeapon = v;
            renderLoadout();
          }
        )
      );

      const grenadeCol = document.createElement('div');
      grenadeCol.style.cssText = 'flex: 1; min-width: 0;';
      grenadeCol.appendChild(
        this.buildSelect(
          'GRENADE POUCH:',
          [
            ['equipped', 'Equipped — throw in-mission with [G]'],
            ['empty', 'No grenades this run']
          ],
          anyGrenadeCarried ? 'equipped' : 'empty',
          v => {
            if (v === 'empty') {
              for (const kind of THROWABLE_ORDER) carry[kind] = false;
            } else {
              carry.flashbang = isThrowableUnlocked('flashbang');
              for (const kind of THROWABLE_ORDER) {
                if (kind !== 'flashbang' && carry[kind] && !isThrowableUnlocked(kind)) {
                  carry[kind] = false;
                }
              }
              if (!THROWABLE_ORDER.some(k => carry[k])) {
                carry.flashbang = isThrowableUnlocked('flashbang');
              }
            }
            renderLoadout();
          },
          false,
          () => true
        )
      );

      const grenadeList = document.createElement('div');
      grenadeList.style.cssText = `margin-top: 8px; padding: 10px 10px; background: ${FIELD_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px;`;
      const grenadeHint = document.createElement('div');
      grenadeHint.style.cssText = `font-size: 10.5px; color: ${MUTED}; margin-bottom: 8px; line-height: 1.4;`;
      grenadeHint.textContent = 'Types to carry (unlock via career):';
      grenadeList.appendChild(grenadeHint);
      for (const kind of THROWABLE_ORDER) {
        const row = document.createElement('label');
        row.style.cssText =
          `display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: ${TEXT}; margin: 5px 0; cursor: pointer;`;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        const unlocked = isThrowableUnlocked(kind);
        cb.checked = !!carry[kind];
        cb.disabled = !unlocked || !anyGrenadeCarried;
        cb.onchange = () => {
          if (!unlocked) return;
          carry[kind] = cb.checked;
          renderLoadout();
        };
        const count = GRENADE_POUCH_STARTING[kind];
        const lock = unlocked ? '' : ` 🔒 ${throwableUnlockHint(kind)}`;
        row.appendChild(cb);
        const text = document.createElement('span');
        text.textContent = `${THROWABLE_LABELS[kind]} ×${count}${lock}`;
        text.style.color = unlocked ? TEXT : MUTED;
        row.appendChild(text);
        grenadeList.appendChild(row);
      }
      grenadeCol.appendChild(grenadeList);
      meleeGrenadeRow.appendChild(meleeCol);
      meleeGrenadeRow.appendChild(grenadeCol);
      loadoutBody.appendChild(meleeGrenadeRow);

      const muzzleOptions = (): [string, string][] =>
        MUZZLE_ARMORY_ORDER.map(id => {
          const mod = MUZZLE_MODIFIERS[id];
          const soundCut = Math.round((1 - mod.soundMult) * 100);
          const speedCut = mod.moveSpeedMult < 1 ? Math.round((1 - mod.moveSpeedMult) * 100) : 0;
          let tag = soundCut > 0 ? ` (−${soundCut}% sound` : '';
          if (speedCut > 0) tag += tag ? `, −${speedCut}% speed)` : ` (−${speedCut}% speed)`;
          else if (tag) tag += ')';
          const locked = !isMuzzleUnlocked(id);
          const lock = locked ? ` 🔒 (${muzzleUnlockHint(id)})` : '';
          return [id, `${MUZZLE_LABELS[id]}${tag}${lock}`] as [string, string];
        });
      const muzzleRow = document.createElement('div');
      muzzleRow.style.cssText = 'display: flex; gap: 14px; margin-bottom: 12px;';
      muzzleRow.appendChild(
        this.buildSelect(
          'PRIMARY MUZZLE:',
          muzzleOptions(),
          loadout.primaryMuzzle,
          v => {
            if (!isMuzzleUnlocked(v as MuzzleType)) return;
            loadout.primaryMuzzle = v as MuzzleType;
            renderLoadout();
          },
          false,
          v => isMuzzleUnlocked(v as MuzzleType)
        )
      );
      muzzleRow.appendChild(
        this.buildSelect(
          'SECONDARY MUZZLE:',
          muzzleOptions(),
          loadout.secondaryMuzzle,
          v => {
            if (!isMuzzleUnlocked(v as MuzzleType)) return;
            loadout.secondaryMuzzle = v as MuzzleType;
            renderLoadout();
          },
          false,
          v => isMuzzleUnlocked(v as MuzzleType)
        )
      );
      loadoutBody.appendChild(muzzleRow);

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

      const gearRow = document.createElement('div');
      gearRow.style.cssText = 'margin-bottom: 12px;';
      gearRow.appendChild(
        this.buildSelect(
          'OPERATIVE GEAR:',
          gearOptions(),
          loadout.operativeGear ?? 'none',
          v => {
            if (!isGearUnlocked(v as OperativeGearId)) return;
            loadout.operativeGear = v as OperativeGearId;
            renderLoadout();
          },
          true,
          id => isGearUnlocked(id as OperativeGearId)
        )
      );
      loadoutBody.appendChild(gearRow);

      statsMount.innerHTML = '';
      statsMount.appendChild(this.buildStatsPanel(loadout));
      broadcastLoadout();
      // Every loadout or mode change ends up here, so this is the one place to persist.
      persistArmory();
      fitStage();
    };
    renderLoadoutRef = renderLoadout;

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
      margin-top: 10px; padding: 10px 28px; font-size: 13px; letter-spacing: 2px; font-weight: bold;
      background: ${FIELD_BG}; color: ${CYAN}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px;
      cursor: pointer; font-family: inherit; display: none;
    `;
    readyBtn.onclick = () => {
      if (!session) return;
      const nextReady = !session.localReady;
      readyBtn.textContent = nextReady ? 'UNREADY' : 'READY';
      session.broadcastLoadout(loadouts[mySlot], nextReady);
      updateDeployButton();
    };

    // ---- Deploy ----
    const deployBtn = document.createElement('button');
    deployBtn.textContent = 'DEPLOY TO SECTOR 1';
    deployBtn.style.cssText = `
      margin-top: 8px; padding: clamp(10px, 1.5vh, 16px) clamp(32px, 6vw, 56px);
      font-size: clamp(13px, 1.6vw, 16px); letter-spacing: 3px; font-weight: bold;
      background: linear-gradient(180deg, #FFB23E, ${ORANGE}); color: #1A0D00; border: none; border-radius: 4px;
      cursor: pointer; font-family: inherit; box-shadow: 0 0 24px rgba(255,158,27,0.45);
    `;
    deployBtn.dataset.padDefault = '';
    deployBtn.onclick = () => {
      if (mode === 'online' && session) {
        if (session.role !== 'HOST' || deployBtn.disabled) return;
        const seed = Math.floor(Math.random() * 0xffffffff);
        session.hostDeploy(seed, runModifier, loadouts[0], session.partnerLoadout ?? loadouts[1]);
        return;
      }
      this.close();
      onDeploy(mode, difficulty, loadouts[0], loadouts[1], runModifier);
    };

    const actionsBar = document.createElement('div');
    actionsBar.style.cssText = 'width: 100%; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; margin-top: 12px; padding-bottom: 4px;';
    actionsBar.appendChild(readyBtn);
    actionsBar.appendChild(deployBtn);
    stage.appendChild(actionsBar);

    // Buttons must exist before setMode — it toggles readyBtn/deployBtn state.
    setDifficulty(difficulty);
    setMode(mode);

    if (session) {
      lobbyPanel = new LobbyPanel(session);
      lobbyPanel.mount(lobbyMount);
      readyBtn.style.display =
        mode === 'online' && session.role !== 'LOCAL' ? 'inline-block' : 'none';
      session.onStateChange = () => {
        lobbyPanel?.refresh();
        readyBtn.textContent = session.localReady ? 'UNREADY' : 'READY';
        updateDeployButton();
        if (session.partnerLoadout) {
          loadouts[mySlot === 0 ? 1 : 0] = session.partnerLoadout;
        }
        fitStage();
      };
      session.onMessage = msg => {
        if (msg.t === 'loadout') {
          loadouts[mySlot === 0 ? 1 : 0] = msg.loadout;
          lobbyPanel?.refresh();
          updateDeployButton();
        }
      };
      session.onDeploy = (seed, mod, hostLoadout, guestLoadout) => {
        this.close();
        const own = session.role === 'HOST' ? hostLoadout : guestLoadout;
        const partner = session.role === 'HOST' ? guestLoadout : hostLoadout;
        const role = session.role === 'HOST' ? 'host' : 'guest';
        onDeploy('online', difficulty, own, partner, mod, { seed, role });
      };
      if (options.createHost && session.role === 'LOCAL') {
        session.createHostSession().catch(() => updateDeployButton());
      } else if (options.joinCode) {
        session.joinSession(options.joinCode);
      } else if (session.role === 'GUEST') {
        session.joinSession(session.roomCode);
      }
    }

    updateDeployButton();
    fitStage();
  }

  private buildPlayerProfilePanel(): HTMLDivElement {
    const profile = loadPlayerProfile();
    const prog = levelProgressFromTotalXp(profile.totalXp);
    const pct = prog.xpForNextLevel > 0 ? Math.min(100, (prog.xpIntoLevel / prog.xpForNextLevel) * 100) : 0;
    const bestGrade = profile.bestGrade ?? '—';
    const bestColor = profile.bestGrade ? GRADE_COLOR[profile.bestGrade] : MUTED;

    const root = document.createElement('div');

    const title = document.createElement('div');
    title.textContent = 'OPERATIVE CAREER';
    title.style.cssText = `font-size: 12px; letter-spacing: 2px; color: ${GREEN}; font-weight: bold; margin-bottom: 16px;`;
    root.appendChild(title);

    const levelRow = document.createElement('div');
    levelRow.style.cssText = 'display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px;';
    levelRow.innerHTML = `
      <span style="font-size: 42px; font-weight: 800; color: ${TEXT}; line-height: 1;">${prog.level}</span>
      <span style="font-size: 13px; letter-spacing: 2px; color: ${MUTED};">OPERATIVE LEVEL</span>
    `;
    root.appendChild(levelRow);

    const xpLabel = document.createElement('div');
    xpLabel.style.cssText = `font-size: 11.5px; letter-spacing: 1px; color: ${MUTED}; margin-bottom: 6px;`;
    xpLabel.textContent = `EXPERIENCE — ${prog.xpIntoLevel} / ${prog.xpForNextLevel} XP TO NEXT LEVEL`;
    root.appendChild(xpLabel);

    const barOuter = document.createElement('div');
    barOuter.style.cssText = `height: 10px; background: ${FIELD_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px; overflow: hidden; margin-bottom: 8px;`;
    const barInner = document.createElement('div');
    barInner.style.cssText = `height: 100%; width: ${pct}%; background: linear-gradient(90deg, #2EE66A, ${GREEN}); border-radius: 3px; transition: width 0.2s;`;
    barOuter.appendChild(barInner);
    root.appendChild(barOuter);

    const totalXp = document.createElement('div');
    totalXp.style.cssText = `font-size: 11px; color: ${MUTED}; margin-bottom: 18px;`;
    totalXp.textContent = `Lifetime XP: ${prog.totalXp.toLocaleString()}`;
    root.appendChild(totalXp);

    const statsBox = document.createElement('div');
    statsBox.style.cssText = `background: ${FIELD_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px; padding: 12px 14px;`;
    const statLine = (label: string, value: string, color: string) => {
      const row = document.createElement('div');
      row.style.cssText = `display: flex; justify-content: space-between; font-size: 12.5px; padding: 4px 0; color: ${MUTED};`;
      row.innerHTML = `<span>${label}</span><span style="color:${color}; font-weight:bold;">${value}</span>`;
      return row;
    };
    statsBox.appendChild(statLine('EXTRACTIONS WON', String(profile.totalWins), CYAN));
    statsBox.appendChild(statLine('BEST MISSION GRADE', bestGrade, bestColor));
    statsBox.appendChild(statLine('PEAK KILLS (ONE RUN)', String(profile.totalKillsBest), ORANGE));
    root.appendChild(statsBox);

    const hint = document.createElement('div');
    hint.style.cssText = `margin-top: 14px; font-size: 11.5px; line-height: 1.5; color: ${MUTED};`;
    hint.textContent =
      'Earn XP from every deployment — wins, mission grades, and eliminations level up your operative and track career milestones. Armory unlocks still follow wins and grades.';
    root.appendChild(hint);

    return root;
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

  private buildSelect(
    label: string,
    options: [string, string][],
    current: string,
    onChange: (value: string) => void,
    fullWidth = false,
    isUnlocked: (value: string) => boolean = value => isWeaponUnlocked(value)
  ): HTMLDivElement {
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
      if (!isUnlocked(value)) opt.disabled = true;
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
    box.style.cssText = `background: ${FIELD_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px; padding: 12px 14px;`;

    const row = (label: string, value: string, color: string) => `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; font-size:12px; padding:3px 0; color:${MUTED}; line-height:1.35;">
        <span style="flex-shrink:0;">${label}:</span>
        <span style="color:${color}; font-weight:bold; text-align:right; flex:1;">${value}</span>
      </div>
    `;

    const heading = (label: string) => `
      <div style="font-size:11.5px; letter-spacing:1px; color:${ORANGE}; font-weight:bold; margin:${
        label === 'LOADOUT STATS' ? '0 0 8px' : label === 'PRIMARY' ? '0 0 4px' : '10px 0 4px'
      };">${label}</div>
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

    const gear = OPERATIVE_GEAR_REGISTRY[loadout.operativeGear ?? 'none'];
    const carry = loadout.throwableCarry ?? DEFAULT_THROWABLE_CARRY;
    const grenadeLines = THROWABLE_ORDER
      .filter(k => carry[k] && isThrowableUnlocked(k))
      .map(k => `${THROWABLE_LABELS[k]} ×${GRENADE_POUCH_STARTING[k]}`)
      .join(', ');
    box.innerHTML =
      heading('LOADOUT STATS') +
      heading('PRIMARY') +
      stats(loadout.primaryWeapon, loadout.primaryMuzzle, loadout.primaryAmmoType) +
      heading('SECONDARY') +
      stats(loadout.secondaryWeapon, loadout.secondaryMuzzle, loadout.secondaryAmmoType) +
      heading('GRENADE POUCH') +
      row('CARRYING', grenadeLines.length ? grenadeLines : 'None selected', grenadeLines.length ? '#FFAB40' : MUTED) +
      row('THROW', '[G] toward aim — max 300px range', MUTED) +
      heading('MELEE') +
      stats(loadout.meleeWeapon, 'none', 'standard') +
      heading('GEAR') +
      row('EQUIPPED', gear.name, CYAN) +
      row('ROLE', gear.description, MUTED);

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
