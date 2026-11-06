import Phaser from 'phaser';
import { CHARACTER_SKINS, NETWORK_EVENTS } from 'shared';
import { api, AuthUser } from './services/api';
import { socket } from './services/socket';
import { sound } from './game/audio/SoundSynth';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { HUDScene } from './game/scenes/HUDScene';

class GameManager {
  private phaserGame: Phaser.Game | null = null;
  public currentUser: AuthUser | null = null;
  public selectedCharacter: string = 'ranger';
  public characterColor: string = '#2e7d32';

  constructor() {
    this.initUI();
    this.checkSession();
  }

  private initUI(): void {
    // Tab switching (Login / Register)
    const tabLogin = document.getElementById('tab-login') as HTMLButtonElement;
    const tabRegister = document.getElementById('tab-register') as HTMLButtonElement;
    const loginForm = document.getElementById('login-form') as HTMLFormElement;
    const registerForm = document.getElementById('register-form') as HTMLFormElement;

    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      this.hideAuthMessages();
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      registerForm.style.display = 'block';
      loginForm.style.display = 'none';
      this.hideAuthMessages();
    });

    // Login submit
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.hideAuthMessages();
      const username = (document.getElementById('login-username') as HTMLInputElement).value;
      const password = (document.getElementById('login-password') as HTMLInputElement).value;

      try {
        const res = await api.login({ username, password });
        this.currentUser = res.user;
        this.selectedCharacter = res.user.profile?.selected_character || 'ranger';
        this.characterColor = res.user.profile?.character_color || '#2e7d32';
        this.showMainMenu();
      } catch (err: any) {
        this.showAuthError(err.message || 'Login failed');
      }
    });

    // Register submit
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.hideAuthMessages();
      const username = (document.getElementById('reg-username') as HTMLInputElement).value;
      const password = (document.getElementById('reg-password') as HTMLInputElement).value;
      const confirmPassword = (document.getElementById('reg-confirm') as HTMLInputElement).value;

      try {
        const res = await api.register({
          username,
          password,
          confirmPassword,
          selectedCharacter: this.selectedCharacter,
          characterColor: this.characterColor
        });
        this.currentUser = res.user;
        // Direct new enlistee to Character selection barracks!
        this.showCharacterModal();
      } catch (err: any) {
        this.showAuthError(err.message || 'Registration failed');
      }
    });

    // Character Barracks Selection
    this.renderCharacterCards();

    document.getElementById('char-save-btn')?.addEventListener('click', async () => {
      if (this.currentUser) {
        try {
          await api.updateCharacter({
            selectedCharacter: this.selectedCharacter,
            characterColor: this.characterColor
          });
          if (this.currentUser.profile) {
            this.currentUser.profile.selected_character = this.selectedCharacter;
            this.currentUser.profile.character_color = this.characterColor;
          }
        } catch (e) {
          console.warn('[Barracks] Local character selection saved:', e);
        }
      }
      this.hideModal('character-modal');
      this.showMainMenu();
    });

    document.getElementById('char-cancel-btn')?.addEventListener('click', () => {
      this.hideModal('character-modal');
      this.showMainMenu();
    });

    // Main Menu Buttons
    document.getElementById('btn-play-now')?.addEventListener('click', () => {
      this.deployToPublicWorld();
    });

    document.getElementById('btn-browse-worlds')?.addEventListener('click', () => {
      this.openWorldBrowser();
    });

    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      this.showModal('create-room-modal');
    });

    document.getElementById('btn-join-room')?.addEventListener('click', () => {
      this.showModal('join-room-modal');
    });

    document.getElementById('btn-open-char')?.addEventListener('click', () => {
      this.showCharacterModal();
    });

    document.getElementById('btn-open-leaderboard')?.addEventListener('click', () => {
      this.openLeaderboard();
    });

    document.getElementById('btn-open-settings')?.addEventListener('click', () => {
      this.showModal('settings-modal');
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      api.logout();
      this.currentUser = null;
      socket.leaveRoom();
      this.showModal('auth-modal');
      this.hideModal('main-menu-modal');
    });

    // Create Room Submit
    document.getElementById('create-room-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('create-room-error')!;
      errBox.style.display = 'none';

      const name = (document.getElementById('cr-name') as HTMLInputElement).value;
      const mode = (document.getElementById('cr-mode') as HTMLSelectElement).value;
      const map = (document.getElementById('cr-map') as HTMLSelectElement).value;
      const max = parseInt((document.getElementById('cr-max') as HTMLSelectElement).value, 10);
      const pass = (document.getElementById('cr-pass') as HTMLInputElement).value;

      try {
        const room = await socket.createCustomRoom({
          roomName: name,
          roomType: mode,
          mapName: map,
          maxPlayers: max,
          password: pass || undefined,
          character: this.selectedCharacter,
          color: this.characterColor,
          username: this.currentUser?.username
        });

        this.hideModal('create-room-modal');
        this.hideModal('main-menu-modal');
        this.startGameSession(room);
      } catch (err: any) {
        errBox.textContent = err.message || 'Failed to create private room';
        errBox.style.display = 'block';
      }
    });

    document.getElementById('cr-cancel-btn')?.addEventListener('click', () => {
      this.hideModal('create-room-modal');
    });

    // Join Room by Code Submit
    document.getElementById('join-code-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('join-code-error')!;
      errBox.style.display = 'none';

      const code = (document.getElementById('join-code-input') as HTMLInputElement).value.trim();
      const pass = (document.getElementById('join-pass-input') as HTMLInputElement).value;

      try {
        const target = await api.joinByCode({ roomCode: code, password: pass || undefined });
        const room = await socket.joinRoomById(target.roomId, {
          character: this.selectedCharacter,
          color: this.characterColor,
          username: this.currentUser?.username,
          password: pass || undefined
        });

        this.hideModal('join-room-modal');
        this.hideModal('main-menu-modal');
        this.startGameSession(room);
      } catch (err: any) {
        errBox.textContent = err.message || 'Unable to join with code';
        errBox.style.display = 'block';
      }
    });

    document.getElementById('join-cancel-btn')?.addEventListener('click', () => {
      this.hideModal('join-room-modal');
    });

    // World Browser Buttons
    document.getElementById('world-refresh-btn')?.addEventListener('click', () => {
      this.openWorldBrowser();
    });
    document.getElementById('world-close-btn')?.addEventListener('click', () => {
      this.hideModal('world-browser-modal');
    });

    // Leaderboard Close
    document.getElementById('leaderboard-close-btn')?.addEventListener('click', () => {
      this.hideModal('leaderboard-modal');
    });

    // Settings Controls
    const sfxSlider = document.getElementById('sfx-slider') as HTMLInputElement;
    const musicSlider = document.getElementById('music-slider') as HTMLInputElement;
    const muteBox = document.getElementById('mute-checkbox') as HTMLInputElement;

    sfxSlider.value = String(sound.sfxVolume);
    musicSlider.value = String(sound.musicVolume);
    muteBox.checked = sound.isMuted;

    sfxSlider.addEventListener('input', () => sound.setSfxVolume(parseFloat(sfxSlider.value)));
    musicSlider.addEventListener('input', () => sound.setMusicVolume(parseFloat(musicSlider.value)));
    muteBox.addEventListener('change', () => sound.setMuted(muteBox.checked));

    document.getElementById('settings-close-btn')?.addEventListener('click', () => {
      this.hideModal('settings-modal');
    });

    // In-game Chat Box
    const chatForm = document.getElementById('chat-form') as HTMLFormElement;
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (text && socket.activeRoom) {
        socket.activeRoom.send(NETWORK_EVENTS.CHAT_MESSAGE, { text });
        chatInput.value = '';
      }
      chatInput.blur();
      window.focus();
    });

    // Enter to open/submit chat, Escape to exit chat immediately back to game
    window.addEventListener('keydown', (e) => {
      if (!socket.activeRoom) return;

      if (e.key === 'Enter') {
        if (document.activeElement === chatInput) {
          // If empty, pressing Enter immediately closes chat and resumes walking
          if (!chatInput.value.trim()) {
            e.preventDefault();
            chatInput.blur();
            window.focus();
          }
        } else {
          e.preventDefault();
          chatInput.focus();
        }
      } else if (e.key === 'Escape' && document.activeElement === chatInput) {
        e.preventDefault();
        chatInput.blur();
        window.focus();
      }
    });

    // Clicking anywhere on the game container or window restores game keyboard control
    document.getElementById('game-container')?.addEventListener('pointerdown', () => {
      if (document.activeElement === chatInput) {
        chatInput.blur();
      }
      window.focus();
    });
  }

  private async checkSession(): Promise<void> {
    const token = api.getToken();
    if (!token) {
      this.showModal('auth-modal');
      return;
    }

    try {
      const user = await api.getProfile();
      this.currentUser = user;
      this.selectedCharacter = user.profile?.selected_character || 'ranger';
      this.characterColor = user.profile?.character_color || '#2e7d32';
      this.showMainMenu();
    } catch (e) {
      api.logout();
      this.showModal('auth-modal');
    }
  }

  private showMainMenu(): void {
    this.hideModal('auth-modal');
    this.hideModal('character-modal');
    this.showModal('main-menu-modal');

    if (this.currentUser) {
      document.getElementById('menu-player-name')!.textContent = this.currentUser.username.toUpperCase();
      document.getElementById('menu-player-level')!.textContent = String(this.currentUser.profile?.level || 1);
      document.getElementById('menu-player-coins')!.textContent = String(this.currentUser.profile?.coins || 100);
      document.getElementById('menu-player-kills')!.textContent = String(this.currentUser.statistics?.kills || 0);
      document.getElementById('menu-player-matches')!.textContent = String(this.currentUser.statistics?.matches_played || 0);
    }
  }

  private showCharacterModal(): void {
    this.hideModal('auth-modal');
    this.hideModal('main-menu-modal');
    this.showModal('character-modal');
  }

  private renderCharacterCards(): void {
    const grid = document.getElementById('character-grid')!;
    grid.innerHTML = '';

    CHARACTER_SKINS.forEach(skin => {
      const card = document.createElement('div');
      card.className = `char-card ${skin.id === this.selectedCharacter ? 'selected' : ''}`;
      card.id = `card-skin-${skin.id}`;

      card.innerHTML = `
        <div class="char-preview-box" style="border: 2px solid ${skin.primaryColor};">
          <div style="width: 28px; height: 38px; background: ${skin.primaryColor}; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>
        </div>
        <div class="char-name">${skin.name}</div>
        <div class="char-role">${skin.role}</div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedCharacter = skin.id;
        this.characterColor = skin.primaryColor;
      });

      grid.appendChild(card);
    });
  }

  private async deployToPublicWorld(): Promise<void> {
    try {
      const room = await socket.joinPublicRoom({
        character: this.selectedCharacter,
        color: this.characterColor,
        username: this.currentUser?.username
      });

      this.hideModal('main-menu-modal');
      this.startGameSession(room);
    } catch (err: any) {
      alert(`Could not deploy to game server: ${err.message || 'Server offline'}`);
    }
  }

  private async openWorldBrowser(): Promise<void> {
    this.showModal('world-browser-modal');
    const tbody = document.getElementById('world-list-body')!;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Scanning battlefield frequencies...</td></tr>';

    try {
      const rooms = await api.getRooms();
      tbody.innerHTML = '';

      if (rooms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #9ca3af; padding: 20px;">No active public battles. Click PLAY NOW to launch the first combat instance!</td></tr>';
        return;
      }

      rooms.forEach((r: any) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="font-weight: 700;">${r.roomName}</td>
          <td>${r.mapName}</td>
          <td style="text-transform: capitalize;">${r.roomType.replace('_', ' ')}</td>
          <td><span style="color: #10b981; font-weight: 700;">${r.playersCount}</span> / ${r.maxPlayers}</td>
          <td>
            <button class="btn-primary" style="padding: 6px 14px; font-size: 11px; width: auto;" data-room-id="${r.roomId}">JOIN</button>
          </td>
        `;

        row.querySelector('button')?.addEventListener('click', async () => {
          try {
            const joinedRoom = await socket.joinRoomById(r.roomId, {
              character: this.selectedCharacter,
              color: this.characterColor,
              username: this.currentUser?.username
            });
            this.hideModal('world-browser-modal');
            this.hideModal('main-menu-modal');
            this.startGameSession(joinedRoom);
          } catch (e: any) {
            alert(`Failed to join world: ${e.message}`);
          }
        });

        tbody.appendChild(row);
      });
    } catch (e: any) {
      tbody.innerHTML = `<tr><td colspan="5" style="color: #ef4444; padding: 20px;">Error loading worlds: ${e.message}</td></tr>`;
    }
  }

  private async openLeaderboard(): Promise<void> {
    this.showModal('leaderboard-modal');
    const tbody = document.getElementById('leaderboard-body')!;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Retrieving tactical leaderboards...</td></tr>';

    try {
      const leaders = await api.getLeaderboard();
      tbody.innerHTML = '';

      if (leaders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #9ca3af; padding: 20px;">No combat records registered yet. Play a match to rank!</td></tr>';
        return;
      }

      leaders.forEach((l: any, idx: number) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="font-weight: 800; color: ${idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : '#9ca3af'};">#${idx + 1}</td>
          <td style="font-weight: 700;">${l.username}</td>
          <td>LVL ${l.level}</td>
          <td style="color: #ef4444; font-weight: 700;">${l.kills}</td>
          <td>${l.deaths}</td>
          <td style="color: #10b981; font-weight: 700;">${l.kdRatio}</td>
          <td>${l.matchesWon}</td>
        `;
        tbody.appendChild(row);
      });
    } catch (e: any) {
      tbody.innerHTML = `<tr><td colspan="7" style="color: #ef4444; padding: 20px;">Failed to fetch leaderboards: ${e.message}</td></tr>`;
    }
  }

  private startGameSession(room: any): void {
    // Unfocus any HTML inputs or modal buttons so keyboard controls immediately control soldier!
    if (document.activeElement && (document.activeElement as HTMLElement).blur) {
      (document.activeElement as HTMLElement).blur();
    }
    window.focus();

    // Attach chat listener
    const chatLog = document.getElementById('chat-log')!;
    chatLog.innerHTML = '';

    room.state.chatMessages.onAdd((msg: any) => {
      const entry = document.createElement('div');
      entry.className = `chat-msg ${msg.isSystem ? 'system' : ''}`;
      entry.innerHTML = `<strong>${msg.senderName}:</strong> ${msg.text}`;
      chatLog.appendChild(entry);
      chatLog.scrollTop = chatLog.scrollHeight;
    });

    // If Phaser game not yet created, instantiate
    if (!this.phaserGame) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: 'game-container',
        width: window.innerWidth,
        height: window.innerHeight,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH
        },
        input: {
          keyboard: {
            target: window
          },
          mouse: {
            target: window
          },
          touch: {
            target: window
          }
        },
        scene: [BootScene, GameScene, HUDScene],
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
          }
        },
        fps: {
          target: 60,
          forceSetTimeOut: true
        }
      };

      this.phaserGame = new Phaser.Game(config);
    } else {
      // Restart game scene with new room
      const gameScene = this.phaserGame.scene.getScene('GameScene') as GameScene;
      if (gameScene) {
        gameScene.scene.restart();
      }
    }

    // Regain focus on canvas
    setTimeout(() => {
      window.focus();
      const canvas = document.querySelector('#game-container canvas') as HTMLCanvasElement;
      if (canvas) {
        canvas.setAttribute('tabindex', '0');
        canvas.focus();
      }
    }, 150);
  }

  private showModal(id: string): void {
    document.getElementById(id)?.classList.remove('hidden');
  }

  private hideModal(id: string): void {
    document.getElementById(id)?.classList.add('hidden');
  }

  private showAuthError(msg: string): void {
    const err = document.getElementById('auth-error')!;
    err.textContent = msg;
    err.style.display = 'block';
  }

  private hideAuthMessages(): void {
    const err = document.getElementById('auth-error')!;
    const succ = document.getElementById('auth-success')!;
    err.style.display = 'none';
    succ.style.display = 'none';
  }
}

// Boot Client
window.addEventListener('DOMContentLoaded', () => {
  new GameManager();
});
