import { Game } from './core/Game';
import { AssetLoader } from './core/AssetLoader';
import { MainMenu } from './ui/MainMenu';
import { ArmoryMenu, GameMode } from './ui/ArmoryMenu';
import { ExtractionModal, RunStats } from './ui/ExtractionModal';
import { PauseMenu } from './ui/PauseMenu';
import { WeaponLoadout } from './entities/Player';
import { MenuGamepadNav } from './ui/MenuGamepadNav';
import { Difficulty } from './config/difficulty';
import { recordRun, recordsForDifficulty } from './ui/RunRecords';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const overlay = document.getElementById('ui-overlay') as HTMLDivElement;
  if (!canvas || !overlay) {
    console.error('Required DOM elements not found!');
    return;
  }

  const assets = new AssetLoader();
  await assets.loadAll();

  const mainMenu = new MainMenu(overlay);
  const armory = new ArmoryMenu(overlay);
  const extractionModal = new ExtractionModal(overlay);
  const pauseMenu = new PauseMenu(overlay);
  let activeGame: Game | null = null;

  const openArmory = () => {
    armory.open((mode: GameMode, difficulty: Difficulty, p1: WeaponLoadout, p2: WeaponLoadout) => deploy(mode, difficulty, p1, p2));
  };

  const deploy = (mode: GameMode, difficulty: Difficulty, p1Loadout: WeaponLoadout, p2Loadout: WeaponLoadout) => {
    activeGame?.stop();
    activeGame = new Game(
      canvas,
      [p1Loadout, p2Loadout],
      assets,
      {
        onMissionEnd: (stats: RunStats) => {
          pauseMenu.hide();
          const newBest = recordRun(stats);
          extractionModal.show(stats, () => openArmory(), newBest, recordsForDifficulty(stats.difficulty));
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
              onQuit: () => activeGame?.stop()
            });
          } else {
            pauseMenu.hide();
          }
        }
      },
      mode === 'solo',
      difficulty
    );
    activeGame.start();
  };

  new MenuGamepadNav(overlay).start();
  mainMenu.open(() => openArmory());
  console.log('HUSHFIRE Game Engine Initialized Successfully.');
});
