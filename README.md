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

- **Sidebar** collapses to an icon rail (button or <kbd>⌘\\</kbd>)
- **Workflow menu**: rename inline, duplicate, and recent workflows
- **Editor / Runs** segmented toggle; Runs shows a mock run history
- **Canvas**: click a block to inspect it. Zoom with −/+, <kbd>⌘</kbd>+wheel or <kbd>⌘0</kbd>. Pan by dragging, with the hand tool (<kbd>H</kbd>) or by holding Space. The outline popover jumps to a block, and fit-to-screen is <kbd>⇧1</kbd>
- **Inspector**: inputs and outcomes load with a short delay, the description is editable, and Refresh re-runs loading
- **Delete block** (button or <kbd>Delete</kbd>) closes the gap, with Undo
- **Share** and **Publish** popovers; publishing flips the badge from Draft to Live

## Stack

- **Next.js 16** (App Router, React 19)
- **Tailwind CSS v4** with design tokens in `app/globals.css` (adapted from Statsnap) plus app tokens in `app/alloway.css`
- **shadcn/ui on Base UI** primitives in `components/ui`
- **lucide-react** icons; every Figma icon, logo and image is a local file in `public/figma/`

## Project layout

| Path | What it is |
| --- | --- |
| [`components/alloway-app.tsx`](components/alloway-app.tsx) | App shell and editor state |
| [`components/sidebar.tsx`](components/sidebar.tsx) | Collapsible sidebar |
| [`components/top-bar.tsx`](components/top-bar.tsx) | Workflow menu, Editor/Runs toggle, Share and Publish |
| [`components/workflow-canvas.tsx`](components/workflow-canvas.tsx) | Pan/zoom canvas, connectors and bottom toolbar |
| [`components/block-card.tsx`](components/block-card.tsx) | Workflow block card |
| [`components/inspector.tsx`](components/inspector.tsx) | Right-hand block inspector |
| [`components/runs-view.tsx`](components/runs-view.tsx) | Mock runs table |
| [`components/asset.tsx`](components/asset.tsx) | Local Figma asset helper |
| [`lib/data.ts`](lib/data.ts) | Mock workflow, blocks and asset paths |
| [`lib/workflow.ts`](lib/workflow.ts) | Layout from Figma geometry, delete logic and outcomes |
