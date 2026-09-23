import { TEXT, ORANGE, MUTED } from './theme';

/**
 * Renders the "mission aborted" goodbye state into `root` and attempts
 * window.close(). A real browser tab opened by the user (not by script)
 * won't actually close — that's expected, hence the manual-close instruction.
 */
export function showQuitScreen(root: HTMLElement) {
  root.innerHTML = '';
  root.style.cssText = `
    position: absolute; inset: 0; background: rgba(5,6,9,0.98);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: 'Segoe UI', monospace; color: ${TEXT}; text-align: center;
  `;
  const msg = document.createElement('div');
  msg.innerHTML = `
    <div style="font-size:22px; letter-spacing:4px; color:${ORANGE}; margin-bottom:14px;">MISSION ABORTED</div>
    <div style="font-size:13px; color:${MUTED}; letter-spacing:1px;">You may close this browser tab to exit HUSHFIRE.</div>
  `;
  root.appendChild(msg);
  window.close();
}
