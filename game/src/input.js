// PELABUHAN SENJA — keyboard and mouse input.
//
// One small owner of the keys: it tracks which keys are held, exposes the
// driving axes (throttle, steering, brake) so main.js never reads the DOM
// itself, and reports mouse drags for the camera. WASD and the arrow keys
// both drive; Space brakes; R resets the car; Enter starts from the menu.

export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.dragX = 0;
    this.dragY = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._onKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      // Edge trigger: key repeat must not re-fire a shot or a toggle.
      if (!event.repeat) this.justPressed.add(event.code);
      this.keys.add(event.code);
    };
    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    this._onBlur = () => this.keys.clear();
    this._onMouseDown = (event) => {
      this._dragging = true;
      this._lastX = event.clientX;
      this._lastY = event.clientY;
    };
    this._onMouseMove = (event) => {
      if (!this._dragging) return;
      this.dragX += event.clientX - this._lastX;
      this.dragY += event.clientY - this._lastY;
      this._lastX = event.clientX;
      this._lastY = event.clientY;
    };
    this._onMouseUp = () => {
      this._dragging = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // -1..1: positive means the player wants to go forward.
  throttleAxis() {
    let value = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) value += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) value -= 1;
    return value;
  }

  // -1..1: positive means steer left.
  steerAxis() {
    let value = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) value += 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) value -= 1;
    return value;
  }

  braking() {
    return this.isDown('Space');
  }

  // True once per physical key press: consumes the edge, so holding F
  // fires once and holding E toggles on-foot mode once.
  consumePressed(code) {
    if (!this.justPressed.has(code)) return false;
    this.justPressed.delete(code);
    return true;
  }

  resetPressed() {
    return this.isDown('KeyR');
  }

  startPressed() {
    return this.isDown('Enter');
  }

  // Consumes the mouse drag accumulated since the last call, in pixels.
  consumeDrag() {
    const out = { x: this.dragX, y: this.dragY };
    this.dragX = 0;
    this.dragY = 0;
    return out;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
  }
}
