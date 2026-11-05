// Mobile Virtual Dual Joysticks and Touch Controls

export interface TouchInputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  aimAngle: number;
  isShooting: boolean;
  wantsReload: boolean;
  wantsSwitchWeapon: boolean;
}

export class TouchControls {
  private container: HTMLDivElement | null = null;
  public state: TouchInputState = {
    left: false,
    right: false,
    jump: false,
    aimAngle: 0,
    isShooting: false,
    wantsReload: false,
    wantsSwitchWeapon: false
  };

  private isTouchDevice: boolean = false;

  constructor() {
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  public init(parent: HTMLElement): void {
    if (!this.isTouchDevice && window.innerWidth > 900) {
      return; // Desktop mode by default unless viewport is small or touch enabled
    }

    this.container = document.createElement('div');
    this.container.id = 'mobile-touch-controls';
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 50;
      user-select: none;
      -webkit-user-select: none;
    `;

    // Left Movement Joystick Zone
    const leftZone = document.createElement('div');
    leftZone.id = 'left-stick-zone';
    leftZone.style.cssText = `
      position: absolute;
      bottom: 25px;
      left: 25px;
      width: 130px;
      height: 130px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.25);
      pointer-events: auto;
      touch-action: none;
    `;

    const leftNub = document.createElement('div');
    leftNub.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: rgba(76, 175, 80, 0.7);
      border: 2px solid #81c784;
    `;
    leftZone.appendChild(leftNub);

    // Right Aim & Shoot Joystick Zone
    const rightZone = document.createElement('div');
    rightZone.id = 'right-stick-zone';
    rightZone.style.cssText = `
      position: absolute;
      bottom: 25px;
      right: 25px;
      width: 130px;
      height: 130px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.25);
      pointer-events: auto;
      touch-action: none;
    `;

    const rightNub = document.createElement('div');
    rightNub.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: rgba(244, 67, 54, 0.7);
      border: 2px solid #e57373;
    `;
    rightZone.appendChild(rightNub);

    // Action Buttons Container (Reload, Weapon Cycle)
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = `
      position: absolute;
      bottom: 170px;
      right: 25px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: auto;
    `;

    const reloadBtn = document.createElement('button');
    reloadBtn.innerText = 'RELOAD';
    reloadBtn.style.cssText = `
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      background: rgba(33, 150, 243, 0.7);
      border: 1px solid #64b5f6;
      border-radius: 6px;
      touch-action: none;
      cursor: pointer;
    `;
    reloadBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.state.wantsReload = true;
    });

    const swapBtn = document.createElement('button');
    swapBtn.innerText = 'WEAPON';
    swapBtn.style.cssText = `
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      background: rgba(255, 152, 0, 0.7);
      border: 1px solid #ffb74d;
      border-radius: 6px;
      touch-action: none;
      cursor: pointer;
    `;
    swapBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.state.wantsSwitchWeapon = true;
    });

    btnContainer.appendChild(swapBtn);
    btnContainer.appendChild(reloadBtn);

    this.container.appendChild(leftZone);
    this.container.appendChild(rightZone);
    this.container.appendChild(btnContainer);
    parent.appendChild(this.container);

    // Setup Touch Listeners for Left Joystick
    let leftPointerId: number | null = null;
    const centerL = { x: 65, y: 65 };

    const handleLeftMove = (clientX: number, clientY: number) => {
      const rect = leftZone.getBoundingClientRect();
      const x = clientX - rect.left - centerL.x;
      const y = clientY - rect.top - centerL.y;
      const dist = Math.hypot(x, y);
      const maxDist = 45;
      const clampedX = dist > maxDist ? (x / dist) * maxDist : x;
      const clampedY = dist > maxDist ? (y / dist) * maxDist : y;

      leftNub.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;

      // Movement flags
      this.state.left = clampedX < -15;
      this.state.right = clampedX > 15;
      this.state.jump = clampedY < -22;
    };

    leftZone.addEventListener('pointerdown', (e) => {
      leftPointerId = e.pointerId;
      leftZone.setPointerCapture(e.pointerId);
      handleLeftMove(e.clientX, e.clientY);
    });

    leftZone.addEventListener('pointermove', (e) => {
      if (e.pointerId === leftPointerId) {
        handleLeftMove(e.clientX, e.clientY);
      }
    });

    const resetLeft = () => {
      leftPointerId = null;
      leftNub.style.transform = 'translate(-50%, -50%)';
      this.state.left = false;
      this.state.right = false;
      this.state.jump = false;
    };

    leftZone.addEventListener('pointerup', resetLeft);
    leftZone.addEventListener('pointercancel', resetLeft);

    // Setup Touch Listeners for Right Aim Joystick
    let rightPointerId: number | null = null;
    const centerR = { x: 65, y: 65 };

    const handleRightMove = (clientX: number, clientY: number) => {
      const rect = rightZone.getBoundingClientRect();
      const x = clientX - rect.left - centerR.x;
      const y = clientY - rect.top - centerR.y;
      const dist = Math.hypot(x, y);
      const maxDist = 45;
      const clampedX = dist > maxDist ? (x / dist) * maxDist : x;
      const clampedY = dist > maxDist ? (y / dist) * maxDist : y;

      rightNub.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;

      if (dist > 10) {
        this.state.aimAngle = Math.atan2(y, x);
        this.state.isShooting = true;
      }
    };

    rightZone.addEventListener('pointerdown', (e) => {
      rightPointerId = e.pointerId;
      rightZone.setPointerCapture(e.pointerId);
      handleRightMove(e.clientX, e.clientY);
    });

    rightZone.addEventListener('pointermove', (e) => {
      if (e.pointerId === rightPointerId) {
        handleRightMove(e.clientX, e.clientY);
      }
    });

    const resetRight = () => {
      rightPointerId = null;
      rightNub.style.transform = 'translate(-50%, -50%)';
      this.state.isShooting = false;
    };

    rightZone.addEventListener('pointerup', resetRight);
    rightZone.addEventListener('pointercancel', resetRight);
  }

  public destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  }
}

