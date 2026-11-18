export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_ENTER_CAR = 8;
export const ACTION_JUMP = 16;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let clicked = false;
  let pointerLocked = false;
  let enabled = true;

  function onKeyDown(event) {
    if (!enabled || event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    if (pointerLocked) {
      mouseDX += event.movementX || 0;
      mouseDY += event.movementY || 0;
    }
  }
  function onMouseDown(event) {
    if (event.button === 0) clicked = true;
  }
  function onPointerLockChange() {
    pointerLocked = document.pointerLockElement === canvas;
  }
  function onBlur() {
    keys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  function safePointer(fn) {
    try {
      fn();
    } catch {
    }
  }

  return {
    keys,
    get pointerLocked() {
      return pointerLocked;
    },
    requestPointerLock() {
      safePointer(() => {
        if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
      });
    },
    exitPointerLock() {
      safePointer(() => {
        if (document.pointerLockElement) document.exitPointerLock();
      });
    },
    isDown(code) {
      return keys.has(code);
    },
    /** True once for the frame the key went down; call after reading it. */
    wasPressed(code) {
      return pressed.has(code);
    },
    takeMouseDelta() {
      const delta = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return delta;
    },
    takeClick() {
      const was = clicked;
      clicked = false;
      return was;
    },
    /** Edge-triggered game actions, consumed once per frame. */
    takeActions() {
      let actions = 0;
      if (pressed.has('Enter') || pressed.has('Space')) actions |= ACTION_CONFIRM;
      if (pressed.has('Escape') || pressed.has('KeyP')) actions |= ACTION_PAUSE;
      if (pressed.has('KeyE')) actions |= ACTION_INTERACT;
      if (pressed.has('KeyF')) actions |= ACTION_ENTER_CAR;
      if (pressed.has('Space')) actions |= ACTION_JUMP;
      return actions;
    },
    endFrame() {
      pressed.clear();
    },
    setEnabled(value) {
      enabled = value;
      if (!value) keys.clear();
    },
  };
}
