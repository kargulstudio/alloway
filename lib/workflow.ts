import type { Block } from "./data"

/**
 * Canvas geometry, measured from the Figma frame (canvas origin = top-left of
 * the 880×962 canvas area). Cards are 280×93; the vertical rhythm and branch
 * offsets below reproduce the exact Figma positions for the initial workflow
 * and keep the same rhythm when blocks are removed.
 */
export const CARD_W = 280
export const CARD_H = 93
export const TRIGGER_TAB_H = 26
export const ROOT_POS = { x: 300, y: 76 }
/** Size of the Figma canvas frame at 100% zoom. */
export const CANVAS_FRAME = { w: 880, h: 962 }

export type Blocks = Record<string, Block>

export type PlacedBlock = { id: string; x: number; y: number }
export type PlacedEdge =
  | { kind: "connector"; key: string; x: number; y: number }
  | {
      kind: "branch"
      key: string
      /** card origin of the if/else block */
      x: number
      y: number
      hasTrue: boolean
      hasFalse: boolean
    }

export type Layout = { blocks: PlacedBlock[]; edges: PlacedEdge[] }

export function layoutWorkflow(blocks: Blocks, rootId: string | null): Layout {
  const placed: PlacedBlock[] = []
  const edges: PlacedEdge[] = []
  const seen = new Set<string>()

  const place = (id: string | null, x: number, y: number) => {
    if (!id || seen.has(id) || !blocks[id]) return
    seen.add(id)
    const b = blocks[id]
    placed.push({ id, x, y })
    const isTrigger = b.kind === "trigger"

    if (b.branches) {
      edges.push({
        kind: "branch",
        key: `${id}-branch`,
        x,
        y,
        hasTrue: !!b.branches.true,
        hasFalse: !!b.branches.false,
      })
      place(b.branches.true, x - 195, y + 170)
      place(b.branches.false, x + 195, y + 170)
    } else if (b.next) {
      edges.push({ kind: "connector", key: `${id}-next`, x: x + 133, y: y + (isTrigger ? 87 : 85) })
      place(b.next, x, y + (isTrigger ? 148 : 146))
    }
  }

  place(rootId, ROOT_POS.x, ROOT_POS.y)
  return { blocks: placed, edges }
}

/** Depth-first order (true branch before false) — used by the outline popover. */
export function orderedIds(blocks: Blocks, rootId: string | null): string[] {
  const out: string[] = []
  const walk = (id: string | null) => {
    if (!id || !blocks[id] || out.includes(id)) return
    out.push(id)
    const b = blocks[id]
    if (b.branches) {
      walk(b.branches.true)
      walk(b.branches.false)
    } else walk(b.next)
  }
  walk(rootId)
  return out
}

function subtree(blocks: Blocks, id: string | null, acc: string[] = []): string[] {
  if (!id || !blocks[id] || acc.includes(id)) return acc
  acc.push(id)
  const b = blocks[id]
  if (b.branches) {
    subtree(blocks, b.branches.true, acc)
    subtree(blocks, b.branches.false, acc)
  } else subtree(blocks, b.next, acc)
  return acc
}

/**
 * Remove a block. A linear block is spliced out (its successor moves up);
 * an if/else takes both of its branches with it.
 */
export function removeBlock(
  blocks: Blocks,
  rootId: string | null,
  id: string
): { blocks: Blocks; rootId: string | null; removed: string[] } {
  const target = blocks[id]
  if (!target) return { blocks, rootId, removed: [] }

  const removed = target.branches ? subtree(blocks, id) : [id]
  const replacement = target.branches ? null : target.next

  const next: Blocks = {}
  for (const [key, b] of Object.entries(blocks)) {
    if (removed.includes(key)) continue
    let copy = b
    if (b.next === id) copy = { ...copy, next: replacement }
    if (b.branches && (b.branches.true === id || b.branches.false === id)) {
      copy = {
        ...copy,
        branches: {
          true: b.branches.true === id ? replacement : b.branches.true,
          false: b.branches.false === id ? replacement : b.branches.false,
        },
      }
    }
    next[key] = copy
  }

  return { blocks: next, rootId: rootId === id ? replacement : rootId, removed }
}

export type Outcome = { label: string; target: string | null }

export function outcomesFor(blocks: Blocks, id: string): Outcome[] {
  const b = blocks[id]
  if (!b) return []
  if (b.branches) {
    return [
      { label: "Is true", target: b.branches.true ? blocks[b.branches.true]?.title ?? null : null },
      { label: "Is false", target: b.branches.false ? blocks[b.branches.false]?.title ?? null : null },
    ]
  }
  return [{ label: "Completed", target: b.next ? blocks[b.next]?.title ?? null : null }]
}

export function boundsOf(layout: Layout) {
  if (!layout.blocks.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of layout.blocks) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y - TRIGGER_TAB_H)
    maxX = Math.max(maxX, p.x + CARD_W)
    maxY = Math.max(maxY, p.y + CARD_H)
  }
  return { minX, minY, maxX, maxY }
}
