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
/** A block's user offset from its auto-layout position (canvas px). */
export type Offset = { x: number; y: number }
/** Only blocks the user has moved have an entry; the auto layout is the base. */
export type Offsets = Record<string, Offset>
export type Graph = { blocks: Blocks; rootId: string | null; offsets: Offsets }

export type Side = "true" | "false"
/** Where a new block goes: after a linear block, or at the top of an if/else branch. */
export type InsertTarget = { kind: "after"; id: string } | { kind: "branch"; id: string; side: Side }

export type PlacedBlock = { id: string; x: number; y: number }
export type PlacedEdge =
  | { kind: "connector"; key: string; x: number; y: number; from: string; to: string }
  | {
      kind: "branch"
      key: string
      from: string
      children: { true: string | null; false: string | null }
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
      edges.push({ kind: "branch", key: `${id}-branch`, x, y, spread: d, from: id, children: { ...b.branches } })
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
      edges.push({ kind: "connector", key: `${id}-next`, x: x + 133, y: y + step.connector, from: id, to: b.next })
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
  return { graph: { ...graph, blocks, offsets: dropOffsets(graph.offsets, removed) }, removed }
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

export function boundsOf(layout: Pick<Layout, "blocks" | "slots">) {
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

/* ----------------------------------------------------------------- offsets */

/** Canvas dot-grid spacing: drags snap to it and Alt + arrows nudge by it. */
export const GRID = 18

const ZERO: Offset = { x: 0, y: 0 }
export const offsetOf = (offsets: Offsets, id: string | null | undefined): Offset => (id && offsets[id]) || ZERO
export const sameOffset = (a: Offset, b: Offset) => a.x === b.x && a.y === b.y

/** Offsets with `id` set to `offset` (a zero offset removes the entry). */
export function withOffset(offsets: Offsets, id: string, offset: Offset): Offsets {
  const rest = { ...offsets }
  delete rest[id]
  return offset.x === 0 && offset.y === 0 ? rest : { ...rest, [id]: { x: offset.x, y: offset.y } }
}

/** Forget the offsets of removed blocks (same object when none of them had one). */
export function dropOffsets(offsets: Offsets, ids: string[]): Offsets {
  if (!ids.some((id) => id in offsets)) return offsets
  const rest = { ...offsets }
  for (const id of ids) delete rest[id]
  return rest
}

export function moveBlock(graph: Graph, id: string, offset: Offset): Graph {
  if (!graph.blocks[id] || sameOffset(offsetOf(graph.offsets, id), offset)) return graph
  return { ...graph, offsets: withOffset(graph.offsets, id, offset) }
}

/* ----------------------------------------------------------------- routing */

export type Pt = { x: number; y: number }
type Rect = { left: number; right: number; top: number; bottom: number }

/**
 * A connector drawn to a block that no longer sits where the auto layout put
 * it: orthogonal path(s) from the source's bottom port to each target's top port.
 */
export type RoutedEdge = {
  kind: "routed"
  key: string
  from: string
  /** source port (centre of the handle dot) */
  port: Pt
  /** SVG path data, arrowhead included */
  paths: string[]
  labels: { text: string; x: number; y: number }[]
}
/** Resting edges keep the Figma artwork (shifted with their block); moved ones are routed. */
export type ArrangedEdge = PlacedEdge | RoutedEdge
export type Arranged = { blocks: PlacedBlock[]; edges: ArrangedEdge[]; slots: PlacedSlot[] }

/** Handle dot radius; the arrow tip stops this far above the target card (Figma: 7.5px). */
const PORT_R = 7
const TIP_GAP = 7.5
/** Corner radius, shortest run out of a port / into a tip, clearance of a lane beside the cards. */
export const ROUTE = { radius: 8, run: 16, lane: 24 }

type Route = { points: Pt[]; /** midpoint of the bend (or of a straight line) */ mid: Pt; /** middle of the last drop */ drop: Pt }

const overlapX = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right

/**
 * Orthogonal route from a bottom port `s` down into a top port `t`.
 * Below: down, across at `level` (default: halfway), down. Straight when aligned.
 * Above / level with it: down out of the source, along a lane between or beside
 * the two cards, over the target and down into it, so it never crosses them.
 */
export function orthoRoute(s: Pt, t: Pt, src: Rect, dst: Rect | null, level?: number): Route {
  const { run } = ROUTE
  const dx = t.x - s.x
  if (Math.abs(dx) < 0.5 && t.y >= s.y) {
    const mid = { x: s.x, y: (s.y + t.y) / 2 }
    return { points: [s, { x: s.x, y: t.y }], mid, drop: mid }
  }
  const gap = t.y - s.y
  // still below (even if close): a simple down–across–down; corners shrink to fit small gaps
  if (gap >= ROUTE.radius * 1.5) {
    const L = gap >= run * 2 ? Math.min(t.y - run, Math.max(s.y + run, level ?? (s.y + t.y) / 2)) : (s.y + t.y) / 2
    return {
      points: [s, { x: s.x, y: L }, { x: t.x, y: L }, t],
      mid: { x: (s.x + t.x) / 2, y: L },
      drop: { x: t.x, y: (L + t.y) / 2 },
    }
  }
  // around: out below the source, up a lane, in above the target
  let y1 = s.y + run
  if (dst && dst.top > s.y && overlapX(src, dst)) y1 = s.y + Math.min(run, (dst.top - s.y) / 2)
  const y2 = t.y - run
  let lane: number
  if (dst && dst.left - src.right >= run * 2) lane = (src.right + dst.left) / 2
  else if (dst && src.left - dst.right >= run * 2) lane = (dst.right + src.left) / 2
  else {
    const left = Math.min(src.left, dst?.left ?? t.x) - ROUTE.lane
    const right = Math.max(src.right, dst?.right ?? t.x) + ROUTE.lane
    lane = Math.abs(s.x - left) + Math.abs(t.x - left) <= Math.abs(s.x - right) + Math.abs(t.x - right) ? left : right
  }
  return {
    points: [s, { x: s.x, y: y1 }, { x: lane, y: y1 }, { x: lane, y: y2 }, { x: t.x, y: y2 }, t],
    mid: { x: lane, y: (y1 + y2) / 2 },
    drop: { x: t.x, y: (y2 + t.y) / 2 },
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Polyline → path with rounded corners, plus the downward arrowhead at the end. */
export function routePath(points: Pt[], radius = ROUTE.radius): string {
  // drop zero-length and collinear points
  const pts: Pt[] = []
  for (const p of points) {
    const last = pts.at(-1)
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue
    const prev = pts.at(-2)
    if (prev && last && ((prev.x === last.x && last.x === p.x) || (prev.y === last.y && last.y === p.y))) pts.pop()
    pts.push(p)
  }
  const [first] = pts
  let d = `M${r2(first.x)} ${r2(first.y)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, c, b] = [pts[i - 1], pts[i], pts[i + 1]]
    const inLen = Math.hypot(c.x - a.x, c.y - a.y)
    const outLen = Math.hypot(b.x - c.x, b.y - c.y)
    const r = Math.min(radius, inLen / 2, outLen / 2)
    const p1 = { x: c.x + ((a.x - c.x) / inLen) * r, y: c.y + ((a.y - c.y) / inLen) * r }
    const p2 = { x: c.x + ((b.x - c.x) / outLen) * r, y: c.y + ((b.y - c.y) / outLen) * r }
    d += `L${r2(p1.x)} ${r2(p1.y)}Q${r2(c.x)} ${r2(c.y)} ${r2(p2.x)} ${r2(p2.y)}`
  }
  const t = pts.at(-1)!
  const k = 3.18
  return `${d}L${r2(t.x)} ${r2(t.y)}M${r2(t.x - k)} ${r2(t.y - k)}L${r2(t.x)} ${r2(t.y)}L${r2(t.x + k)} ${r2(t.y - k)}`
}

function cardRect(blocks: Blocks, id: string, p: Pt): Rect {
  const tab = blocks[id]?.kind === "trigger" ? TRIGGER_TAB_H : 0
  return { left: p.x, right: p.x + CARD_W, top: p.y - tab, bottom: p.y + CARD_H }
}

/**
 * Apply user offsets to the auto layout. Blocks move by their own offset; an
 * edge whose ends moved together keeps its Figma artwork (so with no offsets
 * this is exactly the auto layout), otherwise it's routed to the new position
 * and its "+" / branch labels sit on the route.
 */
export function arrange(layout: Layout, blocks: Blocks, offsets: Offsets): Arranged {
  const pos = new Map<string, Pt>()
  const placed = layout.blocks.map((p) => {
    const o = offsetOf(offsets, p.id)
    const q = { id: p.id, x: p.x + o.x, y: p.y + o.y }
    pos.set(p.id, q)
    return q
  })
  const routes = new Map<string, Route>()
  const edges: ArrangedEdge[] = layout.edges.map((edge) => {
    const so = offsetOf(offsets, edge.from)
    const s = pos.get(edge.from)
    const shifted = { ...edge, x: edge.x + so.x, y: edge.y + so.y }
    if (!s) return shifted
    const src = cardRect(blocks, edge.from, s)

    if (edge.kind === "connector") {
      const t = pos.get(edge.to)
      if (!t || sameOffset(so, offsetOf(offsets, edge.to))) return shifted
      const port = { x: s.x + CARD_W / 2, y: shifted.y + PORT_R }
      const route = orthoRoute(port, { x: t.x + CARD_W / 2, y: t.y - TIP_GAP }, src, cardRect(blocks, edge.to, t))
      routes.set(edge.key, route)
      return { kind: "routed", key: edge.key, from: edge.from, port, paths: [routePath(route.points)], labels: [] }
    }

    const sides = ["true", "false"] as const
    const aligned = sides.every((side) => {
      const child = edge.children[side]
      return !child || !pos.has(child) || sameOffset(so, offsetOf(offsets, child))
    })
    if (aligned) return shifted
    const cx = s.x + CARD_W / 2
    const port = { x: cx, y: s.y + CARD_H }
    const paths: string[] = []
    const labels: RoutedEdge["labels"] = []
    for (const side of sides) {
      const dir = side === "true" ? -1 : 1
      const child = edge.children[side]
      const t = child ? pos.get(child) : undefined
      // empty branch: the drop to its "Add step" pill, which stays with the if/else
      const tip = t
        ? { x: t.x + CARD_W / 2 + dir * BRANCH.arrowOut, y: t.y - TIP_GAP }
        : { x: cx + dir * (edge.spread + BRANCH.arrowOut), y: s.y + BRANCH.tipY }
      const route = orthoRoute(port, tip, src, t && child ? cardRect(blocks, child, t) : null, s.y + BRANCH.barY)
      routes.set(`${edge.from}-${side}`, route)
      paths.push(routePath(route.points))
      labels.push({ text: side === "true" ? "Is true" : "Is false", ...route.mid })
    }
    return { kind: "routed", key: edge.key, from: edge.from, port, paths, labels }
  })

  const slots = layout.slots.map((slot) => {
    const route = routes.get(slot.key)
    if (route && slot.variant === "connector") return { ...slot, ...route.mid }
    if (route && slot.variant === "branch") return { ...slot, ...route.drop }
    const o = offsetOf(offsets, slot.from)
    return { ...slot, x: slot.x + o.x, y: slot.y + o.y }
  })

  return { blocks: placed, edges, slots }
}
