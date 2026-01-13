/*
  Pixel Art Studio
  Author: TABARC-Code
  Plugin URI: https://github.com/TABARC-Code/

  Additions:
  - Tool: pick (eyedropper).
  - Transform: flip horizontal / flip vertical (undoable.)
  - New Project modal: clear + optional grid size, resets history cleanly

  The boring truth:
  I find most ost “pixel editors” fail by confusing rendering with state.
  We don’t. The buffes the truth. Everything else is decoration.
*/

class PixelArtStudio {
  constructor() {
    this.canvas = document.getElementById("pixelCanvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

    this.gridSize = 16;
    this.pixelSize = 20;

    this.currentColour = "#000000";
    this.tool = "draw"; // draw | fill | erase | pick
    this.brushSize = 1;

    this.isPointerDown = false;
    this.showGrid = true;
    this.gridOpacity = 0.35;

    this.hoverCell = null;
    this.lastPaintedKey = null;

    this.pixels = [];

    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 60;

    this.recentColours = [];
    this.maxRecent = 10;
    this.savedSlots = Array.from({ length: 8 }, () => null);

    this.ui = {
      gridSize: document.getElementById("gridSize"),
      colorPicker: document.getElementById("colorPicker"),
      brushSize: document.getElementById("brushSize"),

      drawTool: document.getElementById("drawTool"),
      fillTool: document.getElementById("fillTool"),
      eraseTool: document.getElementById("eraseTool"),
      pickTool: document.getElementById("pickTool"),

      toggleGrid: document.getElementById("toggleGrid"),
      gridOpacity: document.getElementById("gridOpacity"),

      undoBtn: document.getElementById("undoBtn"),
      redoBtn: document.getElementById("redoBtn"),
      clearBtn: document.getElementById("clearBtn"),

      flipHBtn: document.getElementById("flipHBtn"),
      flipVBtn: document.getElementById("flipVBtn"),

      exportPNG: document.getElementById("exportPNG"),
      exportScale: document.getElementById("exportScale"),
      exportTransparent: document.getElementById("exportTransparent"),

      recentSwatches: document.getElementById("recentSwatches"),
      savedSwatches: document.getElementById("savedSwatches"),

      statusTool: document.getElementById("statusTool"),
      statusBrush: document.getElementById("statusBrush"),
      statusGrid: document.getElementById("statusGrid"),
      statusCell: document.getElementById("statusCell"),

      // Modal
      newProjectBtn: document.getElementById("newProjectBtn"),
      modalOverlay: document.getElementById("modalOverlay"),
      modalClose: document.getElementById("modalClose"),
      modalCancel: document.getElementById("modalCancel"),
      modalConfirm: document.getElementById("modalConfirm"),
      modalKeepGrid: document.getElementById("modalKeepGrid"),
      modalGridSize: document.getElementById("modalGridSize"),
    };

    this.init();
    this.bindEvents();
  }

  init() {
    this.loadSavedSlots();
    this.allocatePixelBuffer();
    this.adjustCanvasSize();
    this.pushHistory("init");
    this.renderPalette();
    this.updateStatus();
    this.render();
  }

  allocatePixelBuffer() {
    this.pixels = Array.from({ length: this.gridSize }, () =>
      Array.from({ length: this.gridSize }, () => null)
    );
  }

  adjustCanvasSize() {
    const maxCanvasPx = 720;
    this.pixelSize = Math.max(6, Math.floor(maxCanvasPx / this.gridSize));
    this.canvas.width = this.gridSize * this.pixelSize;
    this.canvas.height = this.gridSize * this.pixelSize;
    this.ctx.imageSmoothingEnabled = false;
  }

  bindEvents() {
    this.ui.gridSize.addEventListener("change", (e) => {
      this.setGridSize(parseInt(e.target.value, 10), true);
    });

    this.ui.colorPicker.addEventListener("input", (e) => {
      this.setColour(e.target.value, true);
    });

    this.ui.brushSize.addEventListener("change", (e) => {
      this.brushSize = parseInt(e.target.value, 10);
      this.updateStatus();
    });

    this.ui.drawTool.addEventListener("click", () => this.setTool("draw"));
    this.ui.fillTool.addEventListener("click", () => this.setTool("fill"));
    this.ui.eraseTool.addEventListener("click", () => this.setTool("erase"));
    this.ui.pickTool.addEventListener("click", () => this.setTool("pick"));

    this.ui.toggleGrid.addEventListener("click", () => {
      this.showGrid = !this.showGrid;
      this.ui.toggleGrid.textContent = `Grid: ${this.showGrid ? "On" : "Off"}`;
      this.updateStatus();
      this.render();
    });

    this.ui.gridOpacity.addEventListener("input", (e) => {
      this.gridOpacity = Math.max(0, Math.min(1, parseInt(e.target.value, 10) / 100));
      this.render();
    });

    this.ui.undoBtn.addEventListener("click", () => this.undo());
    this.ui.redoBtn.addEventListener("click", () => this.redo());

    this.ui.clearBtn.addEventListener("click", () => {
      this.pushHistory("clear");
      this.clearPixels();
      this.render();
    });

    this.ui.flipHBtn.addEventListener("click", () => this.flipHorizontal());
    this.ui.flipVBtn.addEventListener("click", () => this.flipVertical());

    this.ui.exportPNG.addEventListener("click", () => this.exportPNG());

    // Modal events
    this.ui.newProjectBtn.addEventListener("click", () => this.openModal());
    this.ui.modalClose.addEventListener("click", () => this.closeModal());
    this.ui.modalCancel.addEventListener("click", () => this.closeModal());
    this.ui.modalOverlay.addEventListener("click", (e) => {
      if (e.target === this.ui.modalOverlay) this.closeModal();
    });
    this.ui.modalKeepGrid.addEventListener("change", () => {
      this.ui.modalGridSize.disabled = this.ui.modalKeepGrid.checked;
    });
    this.ui.modalConfirm.addEventListener("click", () => this.confirmNewProject());

    // Pointer events
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerup", () => this.onPointerUp());
    this.canvas.addEventListener("pointercancel", () => this.onPointerUp());
    this.canvas.addEventListener("pointerleave", () => this.onPointerLeave());

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  onKeyDown(e) {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "select" || tag === "textarea") return;

    // Modal handling first. If a dialog is open, the page isn’t in charge.
    if (!this.ui.modalOverlay.hidden) {
      if (e.key === "Escape") {
        e.preventDefault();
        this.closeModal();
      }
      if (e.key === "Enter") {
        // Enter to confirm, because muscle memory matters.
        e.preventDefault();
        this.confirmNewProject();
      }
      return;
    }

    const key = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;

    if (mod && key === "z" && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }

    if ((mod && key === "y") || (mod && key === "z" && e.shiftKey)) {
      e.preventDefault();
      this.redo();
      return;
    }

    if (mod && key === "s") {
      e.preventDefault();
      this.exportPNG();
      return;
    }

    if (key === "d") this.setTool("draw");
    if (key === "e") this.setTool("erase");
    if (key === "f") this.setTool("fill");
    if (key === "i") this.setTool("pick");

    if (key === "g") {
      this.showGrid = !this.showGrid;
      this.ui.toggleGrid.textContent = `Grid: ${this.showGrid ? "On" : "Off"}`;
      this.updateStatus();
      this.render();
    }

    // Brush size quick steps
    if (key === "[") {
      this.brushSize = Math.max(1, this.brushSize - 1);
      this.ui.brushSize.value = String(this.brushSize);
      this.updateStatus();
    }
    if (key === "]") {
      this.brushSize = Math.min(3, this.brushSize + 1);
      this.ui.brushSize.value = String(this.brushSize);
      this.updateStatus();
    }

    // Flips with Shift+H / Shift+V to avoid clobbering normal letters
    if (e.shiftKey && key === "h") this.flipHorizontal();
    if (e.shiftKey && key === "v") this.flipVertical();

    // New project: N. Risky shortcut, but it triggers a modal, not a detonation.
    if (key === "n") this.openModal();
  }

  setGridSize(newSize, destructive = true) {
    this.gridSize = newSize;

    this.allocatePixelBuffer();
    this.adjustCanvasSize();

    // Reset history cause snapshots are grid-size specific.
    // Pretending we can “undo” across different dimensions is how you invent nonsense.
    this.undoStack = [];
    this.redoStack = [];
    this.pushHistory(destructive ? "grid-change" : "grid");

    this.hoverCell = null;
    this.lastPaintedKey = null;

    this.updateStatus();
    this.render();
  }

  setTool(tool) {
    this.tool = tool;

    this.ui.drawTool.classList.toggle("active", tool === "draw");
    this.ui.fillTool.classList.toggle("active", tool === "fill");
    this.ui.eraseTool.classList.toggle("active", tool === "erase");
    this.ui.pickTool.classList.toggle("active", tool === "pick");

    this.updateStatus();
    this.render();
  }

  setColour(colour, fromPicker = false) {
    this.currentColour = colour;
    this.ui.colorPicker.value = colour;

    if (fromPicker) this.addRecentColour(colour);
    this.renderPalette();
    this.render();
  }

  addRecentColour(colour) {
    const c = colour.toLowerCase();
    this.recentColours = this.recentColours.filter(x => x !== c);
    this.recentColours.unshift(c);
    if (this.recentColours.length > this.maxRecent) this.recentColours.pop();
  }

  loadSavedSlots() {
    try {
      const raw = localStorage.getItem("tabarc_pixelstudio_savedSlots");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.savedSlots = Array.from({ length: 8 }, (_, i) => parsed[i] ?? null);
      }
    } catch { /* storage can be broken, app shouldn’t be */ }
  }

  saveSavedSlots() {
    try {
      localStorage.setItem("tabarc_pixelstudio_savedSlots", JSON.stringify(this.savedSlots));
    } catch { /* again: not a bank */ }
  }

  renderPalette() {
    this.ui.recentSwatches.innerHTML = "";
    for (const c of this.recentColours) {
      this.ui.recentSwatches.appendChild(this.makeSwatch(c, {
        selected: c === this.currentColour.toLowerCase(),
        onClick: () => this.setColour(c, false),
        title: c
      }));
    }

    this.ui.savedSwatches.innerHTML = "";
    for (let i = 0; i < this.savedSlots.length; i++) {
      const c = this.savedSlots[i];
      const el = this.makeSwatch(c, {
        selected: c && c.toLowerCase() === this.currentColour.toLowerCase(),
        title: c ? `Slot ${i + 1}: ${c} (Shift+Click to overwrite)` : `Slot ${i + 1}: empty (Shift+Click to save)`,
        onClick: (evt) => {
          if (evt.shiftKey) {
            this.savedSlots[i] = this.currentColour.toLowerCase();
            this.saveSavedSlots();
            this.renderPalette();
            return;
          }
          if (c) this.setColour(c, false);
        }
      });
      this.ui.savedSwatches.appendChild(el);
    }
  }

  makeSwatch(colour, { selected, onClick, title }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch" + (selected ? " swatch--selected" : "") + (!colour ? " swatch--empty" : "");
    btn.title = title || "";
    btn.setAttribute("aria-label", title || "Colour swatch");
    if (colour) btn.style.background = colour;
    btn.addEventListener("click", (e) => onClick(e));
    return btn;
  }

  openModal() {
    this.ui.modalOverlay.hidden = false;

    // Sync modal controls with current state
    this.ui.modalKeepGrid.checked = true;
    this.ui.modalGridSize.value = String(this.gridSize);
    this.ui.modalGridSize.disabled = true;

    // Focus something sensible so keyboard users aren’t abandoned
    this.ui.modalConfirm.focus();
  }

  closeModal() {
    this.ui.modalOverlay.hidden = true;
  }

  confirmNewProject() {
    const keep = this.ui.modalKeepGrid.checked;
    const chosen = parseInt(this.ui.modalGridSize.value, 10);

    this.closeModal();

    if (!keep && chosen !== this.gridSize) {
      this.setGridSize(chosen, true);
      // setGridSize already resets history and renders
      return;
    }

    // Same grid size: clear and reset history cleanly
    this.clearPixels();

    this.undoStack = [];
    this.redoStack = [];
    this.pushHistory("new-project");

    this.hoverCell = null;
    this.lastPaintedKey = null;

    this.updateStatus();
    this.render();
  }

  onPointerDown(e) {
    e.preventDefault();

    this.isPointerDown = true;
    this.lastPaintedKey = null;
    this.canvas.setPointerCapture?.(e.pointerId);

    const cell = this.getCellFromEvent(e);
    if (!cell) return;

    this.hoverCell = cell;

    // Pick is not a drawing action, so no,no history checkpoint.
    if (this.tool === "pick") {
      this.pickColourAt(cell.x, cell.y);
      this.render();
      return;
    }

    // Transform/draw actions should be undoable.
    this.pushHistory("stroke-start");

    if (this.tool === "fill") {
      const target = this.pixels[cell.y][cell.x];
      const replacement = this.currentColour.toLowerCase();
      if (target === replacement) return;

      this.floodFillIterative(cell.x, cell.y, target, replacement);
      this.addRecentColour(replacement);
      this.renderPalette();
      this.render();
      return;
    }

    this.applyToolAt(cell.x, cell.y);
    this.render();
  }

  onPointerMove(e) {
    const cell = this.getCellFromEvent(e);

    if (!cell) {
      this.hoverCell = null;
      this.updateCellStatus(null);
      this.render();
      return;
    }

    this.hoverCell = cell;
    this.updateCellStatus(cell);

    if (!this.isPointerDown) {
      this.render();
      return;
    }

    if (this.tool === "fill" || this.tool === "pick") {
      // Fill is click-only. Pick is click-only.
      return;
    }

    const key = `${cell.x},${cell.y},${this.tool},${this.brushSize}`;
    if (this.lastPaintedKey === key) return;
    this.lastPaintedKey = key;

    this.applyToolAt(cell.x, cell.y);
    this.render();
  }

  onPointerUp() {
    this.isPointerDown = false;
    this.lastPaintedKey = null;
    this.updateHistoryButtons();
  }

  onPointerLeave() {
    this.isPointerDown = false;
    this.hoverCell = null;
    this.lastPaintedKey = null;
    this.updateCellStatus(null);
    this.render();
  }

  getCellFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / this.pixelSize);
    const y = Math.floor((e.clientY - rect.top) / this.pixelSize);
    if (x < 0 || y < 0 || x >= this.gridSize || y >= this.gridSize) return null;
    return { x, y };
  }

  applyToolAt(x, y) {
    const half = Math.floor(this.brushSize / 2);
    const paintValue = this.tool === "erase" ? null : this.currentColour.toLowerCase();

    for (let yy = y - half; yy < y - half + this.brushSize; yy++) {
      for (let xx = x - half; xx < x - half + this.brushSize; xx++) {
        if (xx < 0 || yy < 0 || xx >= this.gridSize || yy >= this.gridSize) continue;
        this.pixels[yy][xx] = paintValue;
      }
    }

    if (paintValue) {
      this.addRecentColour(paintValue);
      this.renderPalette();
    }
  }

  pickColourAt(x, y) {
    const c = this.pixels[y][x];
    if (!c) return; // picking “white nothing” is usually unhelpful
    this.setColour(c, false);

    // Optional UX: return to Draw after picking, because that’s how most people use it.
    // If you want it to stay on pick, delete the next line.
    this.setTool("draw");
  }

  floodFillIterative(startX, startY, targetColour, replacementColour) {
    const stack = [{ x: startX, y: startY }];
    while (stack.length) {
      const { x, y } = stack.pop();
      if (x < 0 || y < 0 || x >= this.gridSize || y >= this.gridSize) continue;
      const current = this.pixels[y][x];
      if (current !== targetColour) continue;
      this.pixels[y][x] = replacementColour;

      stack.push({ x: x - 1, y });
      stack.push({ x: x + 1, y });
      stack.push({ x, y: y - 1 });
      stack.push({ x, y: y + 1 });
    }
  }

  clearPixels() {
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        this.pixels[y][x] = null;
      }
    }
  }

  flipHorizontal() {
    // Flip should be undoable, so snapshot first.
    this.pushHistory("flip-h");

    for (let y = 0; y < this.gridSize; y++) {
      this.pixels[y].reverse();
    }

    this.render();
  }

  flipVertical() {
    this.pushHistory("flip-v");
    this.pixels.reverse();
    this.render();
  }

  snapshot() {
    const flat = new Array(this.gridSize * this.gridSize);
    let i = 0;
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        flat[i++] = this.pixels[y][x];
      }
    }
    return { gridSize: this.gridSize, flat };
  }

  restoreSnapshot(snap) {
    if (!snap || snap.gridSize !== this.gridSize) return;
    let i = 0;
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        this.pixels[y][x] = snap.flat[i++];
      }
    }
  }

  pushHistory(reason = "change") {
    const snap = this.snapshot();
    this.undoStack.push(snap);

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.redoStack = [];
    this.updateHistoryButtons();
  }

  undo() {
    if (this.undoStack.length < 2) return;

    const current = this.undoStack.pop();
    this.redoStack.push(current);

    const prev = this.undoStack[this.undoStack.length - 1];
    this.restoreSnapshot(prev);

    this.updateHistoryButtons();
    this.render();
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this.restoreSnapshot(next);

    this.updateHistoryButtons();
    this.render();
  }

  updateHistoryButtons() {
    this.ui.undoBtn.disabled = this.undoStack.length < 2;
    this.ui.redoBtn.disabled = this.redoStack.length === 0;

    this.ui.undoBtn.style.filter = this.ui.undoBtn.disabled ? "grayscale(0.4) opacity(0.75)" : "none";
    this.ui.redoBtn.style.filter = this.ui.redoBtn.disabled ? "grayscale(0.4) opacity(0.75)" : "none";
  }
// Its late, im knackered
  updateStatus() {
    const toolName =
      this.tool === "draw" ? "Draw" :
      this.tool === "fill" ? "Fill" :
      this.tool === "erase" ? "Erase" : "Pick";

    this.ui.statusTool.textContent = `Tool: ${toolName}`;
    this.ui.statusBrush.textContent = `Brush: ${this.brushSize}`;
    this.ui.statusGrid.textContent = `Grid: ${this.showGrid ? "On" : "Off"}`;
  }

  updateCellStatus(cell) {
    this.ui.statusCell.textContent = cell ? `Cell: ${cell.x},${cell.y}` : "Cell: –";
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const c = this.pixels[y][x];
        if (!c) continue;
        this.ctx.fillStyle = c;
        this.ctx.fillRect(
          x * this.pixelSize,
          y * this.pixelSize,
          this.pixelSize,
          this.pixelSize
        );
      }
    }

    this.drawHoverPreview();

    if (this.showGrid && this.gridOpacity > 0) {
      this.drawGridLines();
    }
  }

  drawHoverPreview() {
    if (!this.hoverCell) return;
    if (this.isPointerDown && (this.tool === "fill" || this.tool === "pick")) return;

    const { x, y } = this.hoverCell;

    this.ctx.save();
    this.ctx.globalAlpha = 0.35;

    if (this.tool === "erase") {
      this.ctx.fillStyle = "rgba(45, 52, 54, 0.45)";
    } else if (this.tool === "pick") {
      // Pick tool preview: a subtle outline only. No fill.
      this.ctx.globalAlpha = 0.9;
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "rgba(0,0,0,0.25)";
      this.ctx.strokeRect(
        x * this.pixelSize + 1,
        y * this.pixelSize + 1,
        this.pixelSize - 2,
        this.pixelSize - 2
      );
      this.ctx.restore();
      return;
    } else {
      this.ctx.fillStyle = this.currentColour;
    }

    const half = Math.floor(this.brushSize / 2);
    for (let yy = y - half; yy < y - half + this.brushSize; yy++) {
      for (let xx = x - half; xx < x - half + this.brushSize; xx++) {
        if (xx < 0 || yy < 0 || xx >= this.gridSize || yy >= this.gridSize) continue;
        this.ctx.fillRect(
          xx * this.pixelSize,
          yy * this.pixelSize,
          this.pixelSize,
          this.pixelSize
        );
      }
    }

    this.ctx.globalAlpha = 0.9;
    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = "rgba(0,0,0,0.18)";
    this.ctx.strokeRect(
      x * this.pixelSize + 1,
      y * this.pixelSize + 1,
      this.pixelSize - 2,
      this.pixelSize - 2
    );

    this.ctx.restore();
  }

  drawGridLines() {
    this.ctx.save();
    const alpha = 0.35 * this.gridOpacity;
    this.ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    this.ctx.lineWidth = 1;

    for (let i = 0; i <= this.gridSize; i++) {
      const p = i * this.pixelSize;

      this.ctx.beginPath();
      this.ctx.moveTo(p + 0.5, 0);
      this.ctx.lineTo(p + 0.5, this.canvas.height);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(0, p + 0.5);
      this.ctx.lineTo(this.canvas.width, p + 0.5);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  exportPNG() {
    const scale = parseInt(this.ui.exportScale.value, 10);
    const transparent = this.ui.exportTransparent.checked;

    const out = document.createElement("canvas");
    out.width = this.gridSize * scale;
    out.height = this.gridSize * scale;

    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = false;

    if (!transparent) {
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, out.width, out.height);
    }

    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const c = this.pixels[y][x];
        if (!c) continue;
        octx.fillStyle = c;
        octx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    const link = document.createElement("a");
    link.download = `pixel-art-${this.gridSize}x${this.gridSize}@${scale}x${transparent ? "-transparent" : ""}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }
}

new PixelArtStudio();
