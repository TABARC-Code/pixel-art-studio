# pixel-art-studio
A lightweight, browser-based pixel art editor with pixel-perfect PNG export.

Ok so..

No frameworks.  
No dependencies..  
No canvas hacks pretending to be state.

Built and maintained by **TABARC-Code**.

------

## What this is

Pixel Art Studio is a small, ad is  deliberately constrained web app for creating pixel art on fixed grids.

You can:

- Draw, fill, erase
- Pick colours from the canvas
- Use brush sizes 1–3.
- Undo / Redo.
- Flip the canvas horizontally or vertically
- Manage a colour palette (recent + saved slots.)
- Export clean PNGs at native or scaled resolution.
- Start a new project without accidental data loss

Everything runs locally in the browser.

--------

## What this is'nt

- Not a replacement for somethin like Aseprite.
- Not a “design system”.
- Not a framework demo.
- Not trying to be clever

The goals correctness, clarity, and restraint.

-------

## Core design principles

- **State lives in JavaScript**, not in the canvas.
- The canvas is a rendering surface, nothing more.
- Pixel data is desgned as explicit and predictable.
- Export produces true grid-resolution images
- Undo/Redo real, not simulated
- UI explains itself without documentation. you are nt that dumb live with it

If something feels boring here, thats intentional.

--------

## Controls

### Tools
- **Draw** `D`
- **Erase** `E`
- **Fill** `F`
- **Pick (eyedropper)** `I`

### Canvas
- Toggle grid `G`
- Adjust grid opacity
- Brush size `[` and `]`

### History
- Undo `Ctrl/Cmd + Z`
- Redo `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`

### Transforms
- Flip horizontal `Shift + H`
- Flip vertical `Shift + V`

### Project
- New project `N` (confirmation modal)

### Export
- Export PNG `Ctrl/Cmd + S`
- Optional scaling (nearest-neighbour)
- Optional transparent background

---

## File structure

index.html App structure and UI
styles.css Visual design and layout
script.js Application logic and state
branding/ TABARC assets

No build step. Open `index.html` and draw.

---=------

## Why this exists

Most “simple” canvas demos i fond faile under:
- Recursive flood fill
- Blurry exports
- Mouse-only input
- State living inside pixels

This project avoids all of that on purpose.

It is meant to be read, modified, and learned from.

---------

## Licence

MIT.  
Do what you want. Just don’t pretend you wrote it if you didn’t.

---

## Author

**TABARC-Code**  
https://github.com/TABARC-Code/
