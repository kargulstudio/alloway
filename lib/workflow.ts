import { blockFromTemplate, type Block, type BlockTemplate } from "./data"

/**
 * Canvas geometry, measured from the Figma frame (canvas origin = top-left of
 * the 880×962 canvas area). Cards are 280×93; the vertical rhythm and branch
 * offsets below reproduce the exact Figma positions for the initial workflow
 * and keep the same rhythm as blocks are added and removed.
 */
export const CARD_W = 280
export const CARD_H = 93
export const TRIGGER_TAB_H = 26
export const ROOT_POS = { x: 300, y: 76 }
/** Size of the Figma canvas frame at 100% zoom. */
export const CANVAS_FRAME = { w: 880, h: 962 }

/** Linear step: connector (handle + line + arrow) and the gap to the next card. */
const STEP = { connector: 85, next: 146 }
const TRIGGER_STEP = { connector: 87, next: 148 }
/** If/else: children sit 170px below; columns are ±195px apart in Figma (110px gutter). */
export const BRANCH = { dy: 170, spread: 195, gutter: 110, barY: 129.67, tipY: 162.5, arrowOut: 10 }
/** Empty-branch placeholder: a pill just under the arrow tip. */
export const EMPTY_SLOT = { w: 112, h: 30, top: 166 }

export type Blocks = Record<string, Block>
export type Graph = { blocks: Blocks; rootId: string | null }

export type Side = "true" | "false"
/** Where a new block goes: after a linear block, or at the top of an if/else branch. */
export type InsertTarget = { kind: "after"; id: string } | { kind: "branch"; id: string; side: Side }

export type PlacedBlock = { id: string; x: number; y: number }
export type PlacedEdge =
  | { kind: "connector"; key: string; x: number; y: number }
  | {
      kind: "branch"
      key: string
      /** card origin of the if/else block */
      x: number
      y: number
      /** horizontal distance between the if/else column and each child column */
      spread: number
    }
export type PlacedSlot = {
  key: string
  /** centre of the + button, canvas coordinates */
  x: number
  y: number
  target: InsertTarget
  /**
   * connector: on the line between two blocks (hover/focus to reveal)
   * branch:    on the drop into a non-empty branch (hover/focus to reveal)
   * end:       under the last block of a branch (revealed with its card)
   * empty:     placeholder for an empty branch (always visible)
   */
  variant: "connector" | "branch" | "end" | "empty"
  /** block the slot hangs off (end slots render inside that card's node) */
  from: string
}

export type Layout = { blocks: PlacedBlock[]; edges: PlacedEdge[]; slots: PlacedSlot[] }

/** Horizontal extent of a subtree relative to its own card origin. */
type Extent = { min: number; max: number }

export function layoutWorkflow(blocks: Blocks, rootId: string | null): Layout {
  const placed: PlacedBlock[] = []
  const edges: PlacedEdge[] = []
  const slots: PlacedSlot[] = []
  const extents = new Map<string, Extent>()
  const spreads = new Map<string, number>()

  /** if/else column spread: Figma's 195px, wider when nested subtrees would collide. */
  const spreadOf = (id: string, stack: Set<string>): number => {
    const cached = spreads.get(id)
    if (cached !== undefined) return cached
    const b = blocks[id]
    const left = b.branches?.true ? extentOf(b.branches.true, stack) : { min: 0, max: CARD_W }
    const right = b.branches?.false ? extentOf(b.branches.false, stack) : { min: 0, max: CARD_W }
    const spread = Math.max(BRANCH.spread, (left.max - right.min + BRANCH.gutter) / 2)
    spreads.set(id, spread)
    return spread
  }

  const extentOf = (id: string, stack = new Set<string>()): Extent => {
    const cached = extents.get(id)
    if (cached) return cached
    const b = blocks[id]
    if (!b || stack.has(id)) return { min: 0, max: CARD_W }
    stack.add(id)
    let ext: Extent = { min: 0, max: CARD_W }
    if (b.branches) {
      const d = spreadOf(id, stack)
      const left = b.branches.true ? extentOf(b.branches.true, stack) : { min: 0, max: CARD_W }
      const right = b.branches.false ? extentOf(b.branches.false, stack) : { min: 0, max: CARD_W }
      ext = { min: Math.min(0, left.min - d), max: Math.max(CARD_W, right.max + d) }
    } else if (b.next) {
      const n = extentOf(b.next, stack)
      ext = { min: Math.min(0, n.min), max: Math.max(CARD_W, n.max) }
    }
    stack.delete(id)
    extents.set(id, ext)
    return ext
  }

  const seen = new Set<string>()
  const place = (id: string | null, x: number, y: number) => {
    if (!id || seen.has(id) || !blocks[id]) return
    seen.add(id)
    const b = blocks[id]
    placed.push({ id, x, y })
    const step = b.kind === "trigger" ? TRIGGER_STEP : STEP
    const cx = x + CARD_W / 2

    if (b.branches) {
      const d = spreadOf(id, new Set())
      edges.push({ kind: "branch", key: `${id}-branch`, x, y, spread: d })
      for (const side of ["true", "false"] as const) {
        const dir = side === "true" ? -1 : 1
        const child = b.branches[side]
        const arrowX = cx + dir * (d + BRANCH.arrowOut)
        const target: InsertTarget = { kind: "branch", id, side }
        if (child) {
          slots.push({ key: `${id}-${side}`, x: arrowX, y: y + (BRANCH.barY + BRANCH.tipY) / 2, target, variant: "branch", from: id })
          place(child, x + dir * d, y + BRANCH.dy)
        } else {
          slots.push({ key: `${id}-${side}`, x: arrowX, y: y + EMPTY_SLOT.top + EMPTY_SLOT.h / 2, target, variant: "empty", from: id })
        }
      }
    } else if (b.next) {
      edges.push({ kind: "connector", key: `${id}-next`, x: x + 133, y: y + step.connector })
      slots.push({ key: `${id}-next`, x: cx, y: y + step.connector + 30, target: { kind: "after", id }, variant: "connector", from: id })
      place(b.next, x, y + step.next)
    } else {
      slots.push({ key: `${id}-end`, x: cx, y: y + CARD_H + 26, target: { kind: "after", id }, variant: "end", from: id })
    }
  }

  place(rootId, ROOT_POS.x, ROOT_POS.y)
  return { blocks: placed, edges, slots }
}

/** Depth-first order (true branch before false) — used by the outline popover. */
export function orderedIds(blocks: Blocks, rootId: string | null): string[] {
  return subtree(blocks, rootId)
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

/** Blocks on the longest path from the root — the step count of a full run. */
export function longestPath(blocks: Blocks, id: string | null, seen = new Set<string>()): number {
  if (!id || !blocks[id] || seen.has(id)) return 0
  seen.add(id)
  const b = blocks[id]
  const rest = b.branches
    ? Math.max(longestPath(blocks, b.branches.true, seen), longestPath(blocks, b.branches.false, seen))
    : longestPath(blocks, b.next, seen)
  seen.delete(id)
  return 1 + rest
}

/** Point every reference to `from` at `to` (parents' next / branch pointers). */
function relink(blocks: Blocks, from: string, to: string | null): Blocks {
  const out: Blocks = {}
  for (const [key, b] of Object.entries(blocks)) {
    let copy = b
    if (b.next === from) copy = { ...copy, next: to }
    if (b.branches && (b.branches.true === from || b.branches.false === from)) {
      copy = {
        ...copy,
        branches: {
          true: b.branches.true === from ? to : b.branches.true,
          false: b.branches.false === from ? to : b.branches.false,
        },
      }
    }
    out[key] = copy
  }
  return out
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

  const kept: Blocks = {}
  for (const [key, b] of Object.entries(blocks)) if (!removed.includes(key)) kept[key] = b

  return { blocks: relink(kept, id, replacement), rootId: rootId === id ? replacement : rootId, removed }
}

let idSeq = 0
/** Unique, readable ids for new blocks (`send-email-k3x9-1`). */
export function newId(type: string) {
  idSeq += 1
  return `${type}-${Date.now().toString(36).slice(-4)}-${idSeq}`
}

/** What a slot currently leads to (null = end of branch). */
function successorAt(blocks: Blocks, target: InsertTarget): string | null {
  const b = blocks[target.id]
  if (!b) return null
  return target.kind === "after" ? b.next : (b.branches?.[target.side] ?? null)
}

/**
 * Insert a new block at a slot. Whatever followed the slot moves under the new
 * block; for an if/else that's its "Is true" branch, leaving "Is false" empty.
 */
export function insertBlock(graph: Graph, target: InsertTarget, template: BlockTemplate): { graph: Graph; id: string } {
  const parent = graph.blocks[target.id]
  if (!parent) return { graph, id: "" }
  const id = newId(template.type)
  const successor = successorAt(graph.blocks, target)
  const block = blockFromTemplate(template, id)
  if (block.branches) block.branches = { true: successor, false: null }
  else block.next = successor

  const updatedParent: Block =
    target.kind === "after"
      ? { ...parent, next: id }
      : { ...parent, branches: { ...parent.branches!, [target.side]: id } as NonNullable<Block["branches"]> }

  return { graph: { ...graph, blocks: { ...graph.blocks, [target.id]: updatedParent, [id]: block } }, id }
}

/** Shallow edits (title, description, inputs …) — never structure. */
export function updateBlock(graph: Graph, id: string, patch: Partial<Pick<Block, "title" | "description">>): Graph {
  const b = graph.blocks[id]
  if (!b) return graph
  return { ...graph, blocks: { ...graph.blocks, [id]: { ...b, ...patch } } }
}

/**
 * Change a block's type. Identity (title, chip, icon, inputs) follows the new
 * type; a title the user customised is kept. Structure follows too:
 *   linear → if/else: the old successor becomes the "Is true" branch.
 *   if/else → linear: "Is true" becomes the successor; "Is false" is removed
 *   (returned in `removed` so the caller can offer undo).
 */
export function changeBlockType(
  graph: Graph,
  id: string,
  template: BlockTemplate,
  previous: BlockTemplate | undefined
): { graph: Graph; removed: string[] } {
  const b = graph.blocks[id]
  if (!b || b.type === template.type) return { graph, removed: [] }
  const keepTitle = previous ? b.title.trim() !== previous.title : true
  const fresh = blockFromTemplate(template, id)
  let blocks = { ...graph.blocks }
  let removed: string[] = []

  let next: Block = {
    ...fresh,
    title: keepTitle ? b.title : fresh.title,
    description: b.description,
    next: b.next,
    branches: b.branches,
  }

  if (template.branching && !b.branches) {
    next = { ...next, next: null, branches: { true: b.next, false: null } }
  } else if (!template.branching && b.branches) {
    const { true: keep, false: drop } = b.branches
    if (drop) {
      removed = subtree(blocks, drop)
      for (const r of removed) delete blocks[r]
    }
    next = { ...next, next: keep, branches: undefined }
  }

  blocks = { ...blocks, [id]: next }
  return { graph: { ...graph, blocks }, removed }
}

/** Copy a linear block and place the copy right after the original. */
export function duplicateBlock(graph: Graph, id: string): { graph: Graph; id: string } {
  const b = graph.blocks[id]
  if (!b || b.branches || b.kind === "trigger") return { graph, id: "" }
  const copyId = newId(b.type)
  const copy: Block = { ...b, id: copyId, title: `${b.title} copy`, next: b.next, inputs: b.inputs.map((i) => ({ ...i })) }
  return {
    graph: { ...graph, blocks: { ...graph.blocks, [id]: { ...b, next: copyId }, [copyId]: copy } },
    id: copyId,
  }
}

export type Outcome = { label: string; target: string | null; insert: InsertTarget }

export function outcomesFor(blocks: Blocks, id: string): Outcome[] {
  const b = blocks[id]
  if (!b) return []
  if (b.branches) {
    return (["true", "false"] as const).map((side) => {
      const child = b.branches![side]
      return {
        label: side === "true" ? "Is true" : "Is false",
        target: child ? (blocks[child]?.title ?? null) : null,
        insert: { kind: "branch", id, side },
      }
    })
  }
  return [{ label: "Completed", target: b.next ? (blocks[b.next]?.title ?? null) : null, insert: { kind: "after", id } }]
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
  // empty-branch placeholders are always visible, so they count towards the bounds
  for (const s of layout.slots) {
    if (s.variant !== "empty") continue
    minX = Math.min(minX, s.x - EMPTY_SLOT.w / 2)
    maxX = Math.max(maxX, s.x + EMPTY_SLOT.w / 2)
    maxY = Math.max(maxY, s.y + EMPTY_SLOT.h / 2)
  }
  return { minX, minY, maxX, maxY }
}
