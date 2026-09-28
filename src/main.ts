import { Game } from './core/Game';
import { AssetLoader } from './core/AssetLoader';
import { MainMenu } from './ui/MainMenu';
import { ArmoryMenu, GameMode } from './ui/ArmoryMenu';
import { ExtractionModal, RunStats } from './ui/ExtractionModal';
import { PauseMenu } from './ui/PauseMenu';
import { SectorRewardMenu } from './ui/SectorRewardMenu';
import { WeaponLoadout } from './entities/Player';
import { MenuGamepadNav } from './ui/MenuGamepadNav';
import { Difficulty } from './config/difficulty';
import { SectorModifierId } from './config/sectorModifiers';
import { SessionManager } from './net/SessionManager';
import { mulberry32 } from './core/seededRand';
import { AnimationCatalog } from './graphics/animation/AnimationCatalog';
import { recordRun, recordsForDifficulty } from './ui/RunRecords';
import { recordPlayerProfile, loadPlayerProfile } from './ui/PlayerProfile';
import { nextGradeGoal } from './ui/LetterGrade';
import { RunKind } from './config/runKind';
import { dailyChallengeRand } from './ui/dailyChallenge';
import { SettingsMenu } from './ui/SettingsMenu';
import { loadGameSettings } from './ui/GameSettings';
import { getSharedSoundManager } from './core/SoundManager';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const overlay = document.getElementById('ui-overlay') as HTMLDivElement;
  if (!canvas || !overlay) {
    console.error('Required DOM elements not found!');
    return;
  }

  const settings = loadGameSettings();
  getSharedSoundManager().setMasterVolume(settings.masterVolume);

  const assets = new AssetLoader();
  const animations = new AnimationCatalog();
  await assets.loadAll();
  await animations.loadAll();

  const session = new SessionManager();
  const mainMenu = new MainMenu(overlay);
  const armory = new ArmoryMenu(overlay);
  const extractionModal = new ExtractionModal(overlay);
  const pauseMenu = new PauseMenu(overlay);
  const sectorRewardMenu = new SectorRewardMenu(overlay);
  const settingsMenu = new SettingsMenu(overlay);
  let activeGame: Game | null = null;
  let pendingRunKind: RunKind = 'campaign';
  let pendingLayoutRand: () => number = Math.random;

  const deploy = (
    mode: GameMode,
    difficulty: Difficulty,
    p1Loadout: WeaponLoadout,
    p2Loadout: WeaponLoadout,
    runModifier: SectorModifierId,
    net?: { seed: number; role: 'host' | 'guest' }
  ) => {
    activeGame?.stop();
    const solo = mode === 'solo';
    const layoutRand = net ? mulberry32(net.seed) : pendingLayoutRand;
    const runKind = pendingRunKind;
    const online = mode === 'online' && session.role !== 'LOCAL' && net ? { session, role: net.role } : undefined;
    activeGame = new Game(
      canvas,
      [p1Loadout, p2Loadout],
      assets,
      {
        onMissionEnd: (stats: RunStats) => {
          pauseMenu.hide();
          sectorRewardMenu.hide();
          const newBest = recordRun(stats);
          const letter = recordPlayerProfile(stats);
          const profile = loadPlayerProfile();
          extractionModal.show(
            stats,
            () => openArmory(),
            newBest,
            recordsForDifficulty(stats.difficulty),
            letter,
            nextGradeGoal(stats, profile.bestGrade)
          );
        },
        onPauseChange: (paused: boolean) => {
          if (paused) {
            pauseMenu.show({
              onResume: () => activeGame?.togglePause(),
              onRestart: () => {
                activeGame?.stop();
                pauseMenu.hide();
                openArmory();
              },
              onQuit: () => {
                activeGame?.stop();
                session.destroy();
              }
            });
          } else {
            pauseMenu.hide();
          }
        },
        onSectorReward: (info, onChosen) => {
          sectorRewardMenu.show(info.sectorName, info.nextSectorName, onChosen);
        },
        onSectorRewardGuestWait: info => {
          sectorRewardMenu.showGuestWait(info.sectorName, info.nextSectorName);
        },
        onSectorRewardGuestPick: reward => {
          sectorRewardMenu.showGuestReveal(reward);
        }
      },
      solo,
      difficulty,
      runModifier,
      layoutRand,
      online,
      animations.ready ? animations : null,
      runKind
    );
    activeGame.start();
  };

  const openMainMenu = () => {
    mainMenu.open({
      onStart: () => {
        pendingRunKind = 'campaign';
        pendingLayoutRand = Math.random;
        openArmory();
      },
      onDaily: () => {
        pendingRunKind = 'daily';
        pendingLayoutRand = dailyChallengeRand();
        openArmory();
      },
      onSurvival: () => {
        pendingRunKind = 'survival';
        pendingLayoutRand = Math.random;
        openArmory();
      },
      onSettings: () => {
        settingsMenu.open(() => {
          settingsMenu.hide();
          const s = loadGameSettings();
          getSharedSoundManager().setMasterVolume(s.masterVolume);
          openMainMenu();
        });
      },
      onCreateOnline: () => openArmory({ online: true, host: true }),
      onJoinOnline: code => openArmory({ online: true, joinCode: code })
    });
  };

  const openArmory = (opts: { online?: boolean; host?: boolean; joinCode?: string } = {}) => {
    armory.open(
      (mode, difficulty, p1, p2, runModifier, net) => deploy(mode, difficulty, p1, p2, runModifier, net),
      {
        session,
        startOnline: opts.online ?? session.role !== 'LOCAL',
        createHost: opts.host,
        joinCode: opts.joinCode,
        onBack: () => {
          session.destroy();
          openMainMenu();
        }
      }
    );
  };

  new MenuGamepadNav(overlay).start();

  if (session.role === 'GUEST') {
    mainMenu.close();
    openArmory({ online: true });
  } else {
    openMainMenu();
  }

  (window as unknown as { render_game_to_text: () => string }).render_game_to_text = () =>
    activeGame && activeGame.isRunning()
      ? activeGame.renderGameToText()
      : JSON.stringify({ mode: 'menu' });
  (window as unknown as { advanceTime: (ms: number) => void }).advanceTime = (ms: number) => {
    activeGame?.advanceTime(ms);
  };

  console.log('HUSHFIRE Game Engine Initialized Successfully.');
});
