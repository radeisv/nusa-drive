export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_ENTER_CAR = 8;
export const ACTION_JUMP = 16;

// Keys that scroll the page or move focus if the browser gets them first.
const PREVENTED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

// Which held-this-frame keys raise which edge-triggered action.
const ACTION_BINDINGS = [
  [['Enter', 'Space'], ACTION_CONFIRM], [['Escape', 'KeyP'], ACTION_PAUSE],
  [['KeyE'], ACTION_INTERACT], [['KeyF'], ACTION_ENTER_CAR], [['Space'], ACTION_JUMP],
];

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
    if (PREVENTED.has(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    if (!pointerLocked) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
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
  const listeners = [
    [window, 'keydown', onKeyDown], [window, 'keyup', onKeyUp],
    [window, 'mousemove', onMouseMove], [window, 'mousedown', onMouseDown],
    [window, 'blur', onBlur], [document, 'pointerlockchange', onPointerLockChange],
  ];
  for (const [target, type, handler] of listeners) target.addEventListener(type, handler);
  function safePointer(fn) {
    try { fn(); } catch { /* pointer lock can throw when the page is not focused */ }
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
    // True once for the frame the key went down; call after reading it.
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
    // Edge-triggered game actions, consumed once per frame.
    takeActions() {
      let actions = 0;
      for (const [codes, flag] of ACTION_BINDINGS) {
        for (const code of codes) {
          if (pressed.has(code)) {
            actions |= flag;
            break;
          }
        }
      }
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
