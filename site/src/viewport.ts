// SPDX-License-Identifier: GPL-3.0-or-later

/** Screen position = map position * scale + offset. */
export interface ViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const ZOOM_LIMITS: { min: 0.25; max: 64 } = { min: 0.25, max: 64 };

const clampScale = (scale: number) => Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, scale));

/** Largest scale that shows the whole map, centred. */
export function fitView(
  map: { width: number; height: number },
  view: { width: number; height: number },
): ViewState {
  const raw = Math.min(view.width / map.width, view.height / map.height);
  const scale = clampScale(Number.isFinite(raw) ? raw : ZOOM_LIMITS.min);
  return {
    scale,
    offsetX: (view.width - map.width * scale) / 2,
    offsetY: (view.height - map.height * scale) / 2,
  };
}

/** Zooms by `factor` around the screen point (px, py), which stays on the same map point. */
export function zoomAt(state: ViewState, factor: number, px: number, py: number): ViewState {
  const scale = clampScale(state.scale * factor);
  const k = scale / state.scale;
  return {
    scale,
    offsetX: px - (px - state.offsetX) * k,
    offsetY: py - (py - state.offsetY) * k,
  };
}

export function panBy(state: ViewState, dx: number, dy: number): ViewState {
  return { scale: state.scale, offsetX: state.offsetX + dx, offsetY: state.offsetY + dy };
}

/**
 * Wires wheel zoom, drag pan and DPR-aware sizing to a canvas. `draw` receives a context whose
 * transform is already identity in device pixels; `s` maps map coordinates to device pixels.
 */
export function attachViewport(
  canvas: HTMLCanvasElement,
  draw: (ctx: CanvasRenderingContext2D, s: ViewState) => void,
): {
  fit(map: { width: number; height: number }): void;
  redraw(): void;
  dispose(): void;
} {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas is not available');
  const ctx: CanvasRenderingContext2D = context;
  let state: ViewState = { scale: 1, offsetX: 0, offsetY: 0 };
  let map: { width: number; height: number } | undefined;
  let dragging: { id: number; x: number; y: number } | undefined;

  const dpr = () => window.devicePixelRatio || 1;

  function redraw(): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    draw(ctx, state);
  }

  function fit(next: { width: number; height: number }): void {
    map = next;
    state = fitView(next, { width: canvas.width, height: canvas.height });
    redraw();
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) * dpr();
    const py = (event.clientY - rect.top) * dpr();
    state = zoomAt(state, 1.1 ** -Math.sign(event.deltaY), px, py);
    redraw();
  }

  function onDown(event: PointerEvent): void {
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  }

  function onMove(event: PointerEvent): void {
    if (!dragging || dragging.id !== event.pointerId) return;
    state = panBy(
      state,
      (event.clientX - dragging.x) * dpr(),
      (event.clientY - dragging.y) * dpr(),
    );
    dragging.x = event.clientX;
    dragging.y = event.clientY;
    redraw();
  }

  function onUp(event: PointerEvent): void {
    if (dragging?.id === event.pointerId) dragging = undefined;
  }

  const observer = new ResizeObserver(() => {
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr()));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr()));
    if (w === canvas.width && h === canvas.height) return;
    canvas.width = w;
    canvas.height = h;
    if (map) state = fitView(map, { width: w, height: h });
    redraw();
  });

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  observer.observe(canvas);

  return {
    fit,
    redraw,
    dispose() {
      observer.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    },
  };
}
