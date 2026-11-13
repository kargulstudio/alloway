# Alloway

> [!IMPORTANT]
> **Design prototype only.** No backend, no API and no auth. Everything is mock data in `lib/`, and nothing you do is saved.

A workflow automation editor: a block-based flow on a dotted canvas, with an inspector panel for the selected block.

Built from Figma file `ZKxOvLKOz4VYG21iEqjG4l`, node `1-516` ([open in Figma](https://www.figma.com/design/ZKxOvLKOz4VYG21iEqjG4l/Untitled?node-id=1-516)).

## Run it

```bash
pnpm install
```

```bash
pnpm dev
```

Open <http://localhost:3000>. The design is authored at **1440 × 1024**, so that viewport matches Figma 1:1.

Other scripts: `pnpm build` · `pnpm start` · `pnpm lint`

## What works

Controls whose feature isn't built say so with a single "… is coming soon" toast (`comingSoon()` in [`lib/prototype.ts`](lib/prototype.ts)); everything else really changes the UI.

### Editing the workflow

- **Add a step**: hover a connector (or a branch's drop line, or the space under the last block of a branch) and click **+**. The block picker groups steps by category: Conditions (Filter, If/else), Tasks (Create task, Send email), Records (Find records, Find list entries, Update record, Create record) and Utilities (Delay). Inserting mid-flow pushes the rest down; an If/else takes the rest as its "Is true" branch and starts with an empty "Is false" branch showing an **Add step** pill. The inspector's "End of workflow · Add step" opens the same picker
- **Edit**: the inspector title edits in place, the description is editable and the type chip (e.g. "Logic ▾") changes the block type, or the trigger's event. Double-click a card title (or press <kbd>F2</kbd> on a focused card) to rename it inline. Changing an If/else to a linear step keeps "Is true" and removes "Is false", with Undo
- **Remove and duplicate**: each card has a **…** menu (Rename · Duplicate · Reset position · Delete). <kbd>Delete</kbd>/<kbd>⌫</kbd> removes the selected block and <kbd>⌘D</kbd> duplicates it. Removing a block reconnects its neighbours; removing an If/else removes its branches. The trigger can't be removed, only its event changed
- **Undo / redo**: <kbd>⌘Z</kbd> / <kbd>⇧⌘Z</kbd> (or <kbd>Ctrl+Y</kbd>) step through adds, edits, type changes, duplicates and deletes; typing merges into one step. Delete, duplicate and type-change toasts also carry **Undo**
- **Move blocks**: drag any card, the trigger included (by its body or its tab), to place it freely. A click still selects, and a drag past 3px selects the block and lifts it. Moves snap to the 18px dot grid; hold <kbd>⌥</kbd> while dragging to place it freely, and <kbd>Esc</kbd> cancels a drag. With a card focused or selected, <kbd>⌥</kbd>+arrows nudge it one grid step and <kbd>⇧⌥</kbd>+arrows four. Each drag is one undo step ("Undid: Move …"), and a run of nudges on one block is one step too
- **Tidy up**: the broom button in the canvas toolbar puts every block back in its auto position, gliding there. It's disabled until something has moved, and it's undoable. A card's **…** menu also has **Reset position** for just that block. Undo and redo of moves glide too
- **Connectors follow moved blocks**: links, If/else branches and their **+** buttons re-route live as orthogonal paths with rounded corners, from the source's bottom port to the target's top port. A block moved above its source is reached by a route that goes around both cards
- **Layout** comes from the data ([`lib/workflow.ts`](lib/workflow.ts)): positions, connectors, branch lines (wider when branches nest), canvas bounds and fit-to-screen. A moved block keeps an offset from its auto position. New, inserted and duplicated blocks have none, and deleting a block drops its offset. Bounds and fit-to-screen include moved blocks. With nothing moved, the canvas matches Figma
- The **Publish** block count and the **Runs** step counts follow the edited workflow

### Canvas and chrome

- **Sidebar** collapses to an icon rail (button or <kbd>⌘\\</kbd>): the rail narrows, the toggle glides from the brand row to a slot under the logo, labels and section headings fade, and collapsed items get tooltips. The keyboard toggle is instant, and reduced motion turns the animation off
- **Workflow menu**: rename inline; duplicate and other workflows are coming soon
- **Editor / Runs** segmented toggle; Runs shows a mock run history
- **Canvas**: click a block to inspect it. Zoom with −/+, <kbd>⌘</kbd>+wheel or <kbd>⌘0</kbd>. Pan by dragging, with the hand tool (<kbd>H</kbd>) or by holding Space. The outline popover jumps to a block, and fit-to-screen is <kbd>⇧1</kbd>
- **Inspector**: inputs and outcomes load with a short delay, and Refresh re-runs loading
- **Share** and **Publish** popovers; publishing flips the badge from Draft to Live
- **Favicon** (`app/icon.svg`) and a 180px Apple touch icon (`app/apple-icon.tsx`) from the logo mark

### Phones and tablets

- **Below 1024px** the sidebar is an off-canvas drawer opened from the menu button in the top bar. It closes on <kbd>Esc</kbd>, a tap on the scrim or a navigation tap, and is `inert` while closed. The inspector becomes a bottom sheet that opens when you pick a block and closes with ×, a tap on the scrim or a swipe down on its handle
- **Below 768px** Draft, Share and Publish fold into a **…** menu, the block picker is a bottom sheet with the same categories, and Runs stacks into cards
- **Canvas on touch**: fits the workflow on load, pans with one finger (a tap still selects) and pinch-zooms with two. Press and hold a card for about 300ms to pick it up, with a small lift and a short vibration where supported, then drag to move it. Dragging doesn't open the inspector sheet, but a tap does. The **+** buttons are always visible, and touch targets are at least 40px

## Stack

- **Next.js 16** (App Router, React 19)
- **Tailwind CSS v4** with design tokens in `app/globals.css` (adapted from Statsnap) plus app tokens in `app/alloway.css`
- **shadcn/ui on Base UI** primitives in `components/ui`
- **lucide-react** icons; every Figma icon, logo and image is a local file in `public/figma/`

## Project layout

| Path | What it is |
| --- | --- |
| [`components/alloway-app.tsx`](components/alloway-app.tsx) | App shell and editor state |
| [`components/sidebar.tsx`](components/sidebar.tsx) | Collapsible sidebar / mobile drawer |
| [`components/top-bar.tsx`](components/top-bar.tsx) | Workflow menu, Editor/Runs toggle, Share and Publish |
| [`components/workflow-canvas.tsx`](components/workflow-canvas.tsx) | Pan/zoom canvas, connectors and bottom toolbar |
| [`components/block-card.tsx`](components/block-card.tsx) | Workflow block card with inline rename and the … menu |
| [`components/block-picker.tsx`](components/block-picker.tsx) | Grouped block catalog (menu, or sheet on phones) |
| [`components/inspector.tsx`](components/inspector.tsx) | Block inspector (side panel, or bottom-sheet body) |
| [`components/sheet.tsx`](components/sheet.tsx) | Swipeable bottom sheet (Base UI Dialog) |
| [`components/runs-view.tsx`](components/runs-view.tsx) | Mock runs table |
| [`components/asset.tsx`](components/asset.tsx) | Local Figma asset helper |
| [`lib/data.ts`](lib/data.ts) | Mock workflow, block and trigger catalog, asset paths |
| [`lib/workflow.ts`](lib/workflow.ts) | Layout from Figma geometry, block offsets and connector routing; insert, edit, type-change, duplicate and delete |
| [`lib/use-history.ts`](lib/use-history.ts) | Undo/redo history |
| [`lib/prototype.ts`](lib/prototype.ts) | `comingSoon()` toast for unbuilt features |
