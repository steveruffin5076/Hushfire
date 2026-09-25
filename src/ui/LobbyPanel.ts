import { SessionManager } from '../net/SessionManager';
import { CYAN, ORANGE, TEXT, MUTED, PANEL_BG, PANEL_BORDER, FIELD_BG, GREEN, RED } from './theme';

/** Online lobby controls rendered inside the armory when mode is `online`. */
export class LobbyPanel {
  private root = document.createElement('div');

  constructor(private session: SessionManager) {}

  mount(parent: HTMLElement) {
    parent.appendChild(this.root);
    this.render();
  }

  unmount() {
    this.root.remove();
  }

  /** Re-read session state — ArmoryMenu calls this from its shared onStateChange hook. */
  refresh() {
    this.render();
  }

  private render() {
    const { roomCode, state, error, connectStartedAt, partnerReady, localReady, role } = this.session;
    const elapsed = connectStartedAt ? Math.max(0, Date.now() - connectStartedAt) : 0;
    const status =
      state === 'CONNECTED' ? 'CONNECTED'
      : state === 'SIGNALING' ? `CONNECTING… (${elapsed}ms)`
      : state === 'ERROR' ? (error ?? 'CONNECTION ERROR')
      : state === 'CLOSED' ? 'DISCONNECTED'
      : 'OFFLINE';

    const statusColor = state === 'CONNECTED' ? GREEN : state === 'ERROR' ? RED : MUTED;
    const link = roomCode ? this.session.getShareableLink() : '';

    this.root.innerHTML = '';
    this.root.style.cssText = `
      background: ${PANEL_BG}; border: 1px solid ${PANEL_BORDER}; border-radius: 4px;
      padding: 14px 16px; margin-bottom: 14px; text-align: left;
    `;

    const heading = document.createElement('div');
    heading.textContent = 'ONLINE SESSION';
    heading.style.cssText = `font-size: 12px; letter-spacing: 1px; color: ${ORANGE}; font-weight: bold; margin-bottom: 10px;`;
    this.root.appendChild(heading);

    if (roomCode) {
      const codeRow = document.createElement('div');
      codeRow.style.cssText = 'margin-bottom: 8px;';
      codeRow.innerHTML = `<span style="color:${MUTED};font-size:12px;">ROOM CODE:</span> <span style="color:${CYAN};font-size:22px;letter-spacing:4px;font-weight:bold;">${roomCode}</span>`;
      this.root.appendChild(codeRow);

      const linkRow = document.createElement('div');
      linkRow.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;';
      const input = document.createElement('input');
      input.readOnly = true;
      input.value = link;
      input.style.cssText = `flex:1;padding:8px;font-size:11px;background:${FIELD_BG};color:${TEXT};border:1px solid ${PANEL_BORDER};border-radius:3px;font-family:inherit;`;
      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'COPY LINK';
      copyBtn.style.cssText = `padding:8px 12px;font-size:11px;letter-spacing:1px;background:${FIELD_BG};color:${CYAN};border:1px solid ${PANEL_BORDER};border-radius:3px;cursor:pointer;font-family:inherit;`;
      copyBtn.onclick = () => this.copyLink(link, input);
      linkRow.appendChild(input);
      linkRow.appendChild(copyBtn);
      this.root.appendChild(linkRow);
    }

    const pill = (label: string, ready: boolean) =>
      `<span style="display:inline-block;padding:4px 10px;margin-right:8px;border-radius:12px;font-size:11px;letter-spacing:1px;background:${ready ? 'rgba(0,230,118,0.15)' : 'rgba(138,148,166,0.12)'};color:${ready ? GREEN : MUTED};border:1px solid ${ready ? GREEN : PANEL_BORDER};">${label}: ${ready ? 'READY' : 'NOT READY'}</span>`;

    const statusRow = document.createElement('div');
    statusRow.style.cssText = `font-size:12px;color:${statusColor};margin-bottom:8px;`;
    statusRow.textContent = status;
    this.root.appendChild(statusRow);

    const readyRow = document.createElement('div');
    readyRow.innerHTML = pill('YOU', localReady) + pill(role === 'HOST' ? 'PARTNER' : 'HOST', partnerReady);
    this.root.appendChild(readyRow);
  }

  private async copyLink(link: string, input: HTMLInputElement) {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        return;
      }
    } catch {
      // fall through to execCommand
    }
    input.focus();
    input.select();
    try {
      document.execCommand('copy');
    } catch {
      // manual copy is the only option on insecure LAN dev hosts
    }
  }
}
