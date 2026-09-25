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
import { SessionManager } from './net/SessionManager';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const overlay = document.getElementById('ui-overlay') as HTMLDivElement;
  if (!canvas || !overlay) {
    console.error('Required DOM elements not found!');
    return;
  }

  const assets = new AssetLoader();
  await assets.loadAll();

  const session = new SessionManager();
  const mainMenu = new MainMenu(overlay);
  const armory = new ArmoryMenu(overlay);
  const extractionModal = new ExtractionModal(overlay);
  const pauseMenu = new PauseMenu(overlay);
  const sectorRewardMenu = new SectorRewardMenu(overlay);
  let activeGame: Game | null = null;

  const deploy = (mode: GameMode, difficulty: Difficulty, p1Loadout: WeaponLoadout, p2Loadout: WeaponLoadout) => {
    activeGame?.stop();
    const solo = mode === 'solo';
    activeGame = new Game(
      canvas,
      [p1Loadout, p2Loadout],
      assets,
      {
        onMissionEnd: (stats: RunStats) => {
          pauseMenu.hide();
          sectorRewardMenu.hide();
          extractionModal.show(stats, () => openArmory());
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
        }
      },
      solo,
      difficulty
    );
    activeGame.start();
  };

  const openArmory = (opts: { online?: boolean; host?: boolean; joinCode?: string } = {}) => {
    armory.open((mode, difficulty, p1, p2) => deploy(mode, difficulty, p1, p2), {
      session,
      startOnline: opts.online ?? session.role !== 'LOCAL',
      createHost: opts.host,
      joinCode: opts.joinCode
    });
  };

  new MenuGamepadNav(overlay).start();

  if (session.role === 'GUEST') {
    mainMenu.close();
    openArmory({ online: true });
  } else {
    mainMenu.open({
      onStart: () => openArmory(),
      onCreateOnline: () => openArmory({ online: true, host: true }),
      onJoinOnline: code => openArmory({ online: true, joinCode: code })
    });
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
