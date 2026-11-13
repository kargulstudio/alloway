"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { BroomSparklesIcon, MousePointerClickIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { ASSETS, TONE_COLOR, type BlockTemplate } from "@/lib/data"
import {
  arrange,
  boundsOf,
  BRANCH,
  CANVAS_FRAME,
  CARD_H,
  CARD_W,
  GRID,
  layoutWorkflow,
  offsetOf,
  orderedIds,
  sameOffset,
  TRIGGER_TAB_H,
  type Arranged,
  type ArrangedEdge,
  type Blocks,
  type InsertTarget,
  type Offset,
  type Offsets,
  type PlacedSlot,
} from "@/lib/workflow"
import { BREAKPOINTS } from "@/lib/use-media-query"
import { Asset, Tile } from "./asset"
import { BlockCard } from "./block-card"
import { BlockPicker } from "./block-picker"

type Viewport = { x: number; y: number; z: number }
type Tool = "pointer" | "hand"

const MIN_Z = 0.25
const MAX_Z = 2
const STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]
const clampZ = (z: number) => Math.min(MAX_Z, Math.max(MIN_Z, z))

function zoomAt(v: Viewport, cx: number, cy: number, nextZ: number): Viewport {
  const z = clampZ(nextZ)
  const k = z / v.z
  return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, z }
}

function measure(el: HTMLElement | null) {
  const r = el?.getBoundingClientRect()
  return { w: r?.width ?? CANVAS_FRAME.w, h: r?.height ?? CANVAS_FRAME.h }
}

/**
 * Zoom (≤100%) and offset that fit the whole workflow in a w×h canvas,
 * clear of the floating toolbar. Phones get tighter padding.
 */
function fitView(layout: Pick<Arranged, "blocks" | "slots">, w: number, h: number): Viewport | null {
  const b = boundsOf(layout)
  if (!b) return null
  const compact = w < 640
  const pad = compact ? 16 : 56
  const top = compact ? 28 : pad
  const bottomUi = compact ? 88 : 110 // keep clear of the floating toolbar
  const bw = b.maxX - b.minX
  const bh = b.maxY - b.minY
  const z = clampZ(Math.min((w - pad * 2) / bw, (h - top - bottomUi) / bh, 1))
  return {
    z,
    x: (w - bw * z) / 2 - b.minX * z,
    y: top + (h - top - bottomUi - bh * z) / 2 - b.minY * z,
  }
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))

/* ------------------------------------------------------------ block moves */

/** Mouse: a press turns into a drag past 3px. Touch: hold still this long, then drag. */
const DRAG_THRESHOLD = 3
const LONG_PRESS_MS = 300
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** A block being dragged: its live offset is shown instead of the committed one. */
type Preview = { id: string; x: number; y: number; touch: boolean }
/** Glide between two sets of offsets (Tidy up, undo/redo of a move, a cancelled drag). */
type Tween = { from: Offsets; to: Offsets; ms: number }

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const withPreview = (o: Offsets, p: Preview | null): Offsets => (p ? { ...o, [p.id]: { x: p.x, y: p.y } } : o)
const idsOf = (a: Offsets, b: Offsets) => new Set([...Object.keys(a), ...Object.keys(b)])

function lerpOffsets({ from, to }: Tween, t: number): Offsets {
  const k = easeOut(t)
  const out: Offsets = {}
  for (const id of idsOf(from, to)) {
    const a = offsetOf(from, id)
    const b = offsetOf(to, id)
    out[id] = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
  }
  return out
}

/** Longest distance any block travels, for a duration that suits both a nudge and a Tidy up. */
function tweenFor(from: Offsets, to: Offsets): Tween | null {
  let dist = 0
  for (const id of idsOf(from, to)) {
    const a = offsetOf(from, id)
    const b = offsetOf(to, id)
    dist = Math.max(dist, Math.hypot(b.x - a.x, b.y - a.y))
  }
  if (dist < 0.5) return null
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null
  return { from, to, ms: Math.min(380, 140 + dist * 0.5) }
}

/** The pointer that pressed a block: pending (below threshold / long press) or dragging. */
type Move = {
  pointer: number
  id: string
  touch: boolean
  active: boolean
  /** client position at press (drag threshold) */
  sx: number
  sy: number
  /** pointer at press in canvas coordinates, so a pan or zoom mid-drag keeps the block under it */
  wx: number
  wy: number
  /** committed offset at press, and the offset on screen now */
  start: Offset
  cur: Offset
  last: { x: number; y: number; alt: boolean }
  frame: number
}

/** Swallow the click the browser may fire after a drag, so it doesn't re-select / deselect. */
function swallowNextClick() {
  const swallow = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener("click", swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0)
}

type CanvasProps = {
  blocks: Blocks
  rootId: string | null
  /** user offsets from the auto layout, keyed by block id */
  offsets: Offsets
  selectedId: string | null
  showSelection: boolean
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
  onInsert: (target: InsertTarget, template: BlockTemplate) => void
  onRename: (id: string, title: string) => void
  onDuplicate: (id: string) => void
  /** a drag (or keyboard nudge, `nudge`) moved a block to a new offset */
  onMove: (id: string, offset: Offset, nudge?: boolean) => void
  /** clear every offset (Tidy up) / one block's offset */
  onTidy: () => void
  onResetPosition: (id: string) => void
  /** block that just appeared (plays the enter animation) */
  freshId: string | null
  /** bump `n` to pan a block into view */
  reveal: { id: string; n: number } | null
}

/** Figma 1:643 — #FAFAFA canvas with an 18px dot grid; nodes on a pan/zoom layer. */
export function WorkflowCanvas({
  blocks,
  rootId,
  offsets,
  selectedId,
  showSelection,
  onSelect,
  onDelete,
  onInsert,
  onRename,
  onDuplicate,
  onMove,
  onTidy,
  onResetPosition,
  freshId,
  reveal,
}: CanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    id: number
    sx: number
    sy: number
    ox: number
    oy: number
    moved: boolean
    /** started on bare canvas (a plain click there deselects) */
    onEmpty: boolean
    touch: boolean
  } | null>(null)
  /* active touch points + the pinch gesture they form */
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; view: Viewport } | null>(null)
  const centred = useRef(false)
  const [view, setView] = useState<Viewport>({ x: 0, y: 0, z: 1 })
  const [tool, setTool] = useState<Tool>("pointer")
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [panning, setPanning] = useState(false)
  const gridId = useId()

  /* --- block positions: committed offsets, a live drag preview, or a glide between them */
  const move = useRef<Move | null>(null)
  const pressTimer = useRef<number | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [tween, setTween] = useState<Tween | null>(null)
  const [tweenT, setTweenT] = useState(0)
  const [seen, setSeen] = useState({ offsets, blocks })
  if (offsets !== seen.offsets || blocks !== seen.blocks) {
    // Offsets changed (drop, nudge, Tidy up, undo/redo): glide from what's on screen.
    // A structural edit restacks with the nodes' own CSS transition instead.
    const shownBefore = withPreview(tween ? lerpOffsets(tween, tweenT) : seen.offsets, preview)
    const next = blocks === seen.blocks && offsets !== seen.offsets ? tweenFor(shownBefore, offsets) : null
    setSeen({ offsets, blocks })
    if (offsets !== seen.offsets) setPreview(null)
    setTween(next)
    setTweenT(0)
  }
  const shown = useMemo(
    () => withPreview(tween ? lerpOffsets(tween, tweenT) : offsets, preview),
    [tween, tweenT, offsets, preview]
  )
  const moving = preview !== null || tween !== null

  /* advance a glide one frame at a time */
  useEffect(() => {
    if (!tween) return
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / tween.ms)
      if (t >= 1) {
        setTween((cur) => (cur === tween ? null : cur))
        return
      }
      setTweenT(t)
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [tween])

  const layout = useMemo(() => layoutWorkflow(blocks, rootId), [blocks, rootId])
  /** on screen (drag preview / glide) vs. at rest (bounds, fit, reveal) */
  const arranged = useMemo(() => arrange(layout, blocks, shown), [layout, blocks, shown])
  const resting = useMemo(() => arrange(layout, blocks, offsets), [layout, blocks, offsets])
  const restingRef = useRef(resting)
  const offsetsRef = useRef(offsets)
  const viewRef = useRef(view)
  useEffect(() => {
    restingRef.current = resting
    offsetsRef.current = offsets
    viewRef.current = view
  }, [resting, offsets, view])
  const order = useMemo(() => orderedIds(blocks, rootId), [blocks, rootId])
  const endSlots = useMemo(
    () => new Map(arranged.slots.filter((s) => s.variant === "end").map((s) => [s.from, s])),
    [arranged]
  )
  const panMode = tool === "hand" || spaceHeld

  /*
   * Desktop: centre the 880px Figma frame horizontally (0 at 1440).
   * Below lg (phones, tablets): fit the whole workflow on screen instead.
   */
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (centred.current) return
      const { width: w, height: h } = entry.contentRect
      // a hidden tab / not-yet-laid-out canvas reports 0×0 — wait for a real size
      if (w < 1 || h < 1) return
      centred.current = true
      const fit = window.matchMedia(BREAKPOINTS.lg).matches ? null : fitView(restingRef.current, w, h)
      setView((v) => fit ?? { ...v, x: Math.round((w - CANVAS_FRAME.w) / 2) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* Wheel: pan; ctrl/⌘ + wheel (and trackpad pinch): zoom around the cursor. */
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest?.("[data-canvas-ui]")) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.01))
        setView((v) => zoomAt(v, e.clientX - r.left, e.clientY - r.top, v.z * factor))
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const size = useCallback(() => measure(viewportRef.current), [])

  const zoomBy = useCallback((dir: 1 | -1) => {
    const { w, h } = size()
    setView((v) => {
      const target =
        dir > 0 ? (STEPS.find((s) => s > v.z + 0.001) ?? MAX_Z) : ([...STEPS].reverse().find((s) => s < v.z - 0.001) ?? MIN_Z)
      return zoomAt(v, w / 2, h / 2, target)
    })
  }, [size])

  const resetZoom = useCallback(() => {
    const { w, h } = size()
    setView((v) => zoomAt(v, w / 2, h / 2, 1))
  }, [size])

  const fitToView = useCallback(() => {
    const { w, h } = size()
    const fit = fitView(resting, w, h)
    if (fit) setView(fit)
  }, [resting, size])

  const centreOn = useCallback(
    (id: string) => {
      const p = resting.blocks.find((b) => b.id === id)
      if (!p) return
      const { w, h } = size()
      setView((v) => ({ ...v, x: w / 2 - (p.x + CARD_W / 2) * v.z, y: (h - 80) / 2 - (p.y + CARD_H / 2) * v.z }))
    },
    [resting, size]
  )

  /* Pan just enough to bring a new / jumped-to block fully into view. */
  useEffect(() => {
    if (!reveal) return
    const frame = requestAnimationFrame(() => {
      const p = restingRef.current.blocks.find((b) => b.id === reveal.id)
      if (!p) return
      const { w, h } = size()
      const pad = 48
      const bottomUi = 110
      setView((v) => {
        const left = v.x + p.x * v.z
        const top = v.y + (p.y - TRIGGER_TAB_H) * v.z
        const right = v.x + (p.x + CARD_W) * v.z
        const bottom = v.y + (p.y + CARD_H + 40) * v.z
        let dx = 0
        let dy = 0
        if (left < pad) dx = pad - left
        else if (right > w - pad) dx = w - pad - right
        if (top < pad) dy = pad - top
        else if (bottom > h - bottomUi) dy = h - bottomUi - bottom
        return dx || dy ? { ...v, x: v.x + dx, y: v.y + dy } : v
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [reveal, size])

  /* --------------------------------------------------------- moving blocks */

  const local = (x: number, y: number) => {
    const r = viewportRef.current?.getBoundingClientRect()
    return { x: x - (r?.left ?? 0), y: y - (r?.top ?? 0) }
  }
  /** client point → canvas coordinates under the current pan / zoom */
  const toWorld = useCallback((x: number, y: number) => {
    const r = viewportRef.current?.getBoundingClientRect()
    const v = viewRef.current
    return { x: (x - (r?.left ?? 0) - v.x) / v.z, y: (y - (r?.top ?? 0) - v.y) / v.z }
  }, [])

  /** Where the pointer puts the block: grid-snapped, free with Alt / Option held. */
  const offsetAt = useCallback(
    (m: Move): Offset => {
      const w = toWorld(m.last.x, m.last.y)
      const x = m.start.x + w.x - m.wx
      const y = m.start.y + w.y - m.wy
      return m.last.alt
        ? { x: Math.round(x), y: Math.round(y) }
        : { x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID }
    },
    [toWorld]
  )

  /** One preview update per frame, however many pointer events arrive. */
  const schedule = useCallback(
    (m: Move) => {
      if (m.frame) return
      m.frame = requestAnimationFrame(() => {
        m.frame = 0
        if (move.current !== m || !m.active) return
        const next = offsetAt(m)
        if (sameOffset(next, m.cur)) return
        m.cur = next
        setPreview({ id: m.id, touch: m.touch, ...next })
      })
    },
    [offsetAt]
  )

  const clearPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
    pressTimer.current = null
  }

  /** The press became a drag: capture the pointer, lift the card, select it (docked inspector only). */
  const activate = useCallback(
    (m: Move) => {
      m.active = true
      try {
        viewportRef.current?.setPointerCapture(m.pointer)
      } catch {
        /* pointer already gone */
      }
      if (m.touch) navigator.vibrate?.(10)
      // below lg selecting opens the inspector sheet over the canvas — a tap still does that
      if (window.matchMedia(BREAKPOINTS.lg).matches) onSelect(m.id)
      m.cur = m.touch ? m.start : offsetAt(m)
      setPreview({ id: m.id, touch: m.touch, ...m.cur })
    },
    [offsetAt, onSelect]
  )

  /** Put a dragged block back where it was committed, gliding from where it is now. */
  const settle = useCallback((m: Move) => {
    const committed = offsetsRef.current
    setPreview(null)
    setTween(tweenFor({ ...committed, [m.id]: m.cur }, committed))
    setTweenT(0)
  }, [])

  /** Escape / pointercancel: abandon the drag. */
  const cancelMove = useCallback(() => {
    const m = move.current
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
    pressTimer.current = null
    if (!m) return
    move.current = null
    cancelAnimationFrame(m.frame)
    if (m.active) settle(m)
  }, [settle])

  const drop = (m: Move, e: React.PointerEvent) => {
    move.current = null
    cancelAnimationFrame(m.frame)
    m.last = { x: e.clientX, y: e.clientY, alt: e.altKey }
    const next = offsetAt(m)
    swallowNextClick()
    if (sameOffset(next, offsetOf(offsetsRef.current, m.id))) {
      settle(m)
      return
    }
    // the preview stays until the new offsets arrive, so nothing jumps
    setPreview({ id: m.id, touch: m.touch, ...next })
    onMove(m.id, next)
  }

  const press = (e: React.PointerEvent, id: string, touch: boolean) => {
    const w = toWorld(e.clientX, e.clientY)
    const start = offsetOf(offsetsRef.current, id)
    const m: Move = {
      pointer: e.pointerId,
      id,
      touch,
      active: false,
      sx: e.clientX,
      sy: e.clientY,
      wx: w.x,
      wy: w.y,
      start,
      cur: start,
      last: { x: e.clientX, y: e.clientY, alt: e.altKey },
      frame: 0,
    }
    move.current = m
    if (!touch) return
    clearPress()
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      // still the same finger, still holding still, no pinch: pick the block up
      if (move.current !== m || drag.current?.moved || touches.current.size !== 1) return
      drag.current = null
      activate(m)
    }, LONG_PRESS_MS)
  }

  /* Escape cancels a drag; Alt / Option toggles snapping without moving the pointer. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = move.current
      if (!m?.active) return
      if (e.key === "Escape" && e.type === "keydown") {
        e.preventDefault()
        e.stopImmediatePropagation()
        cancelMove()
      } else if (e.key === "Alt") {
        m.last = { ...m.last, alt: e.type === "keydown" }
        schedule(m)
      }
    }
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("keyup", onKey, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("keyup", onKey, true)
    }
  }, [cancelMove, schedule])

  useEffect(
    () => () => {
      if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
    },
    []
  )

  /* Keyboard: H / V tools, hold Space to pan, ⌘± / ⌘0 zoom, ⇧1 fit, ⌫ delete, ⌘D duplicate,
     ⌥ arrows nudge a block (⇧⌥ by 4 grid steps), Esc deselect. */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      // keys inside a sheet or an open menu belong to it
      if (e.target instanceof Element && e.target.closest("[role=dialog], [role=menu]")) return
      const mod = e.metaKey || e.ctrlKey
      if (e.code === "Space") {
        // Space still activates a focused button / menu item
        if (e.target instanceof Element && e.target.closest("button, [role=button], [role=menuitem]")) return
        e.preventDefault()
        if (!e.repeat) setSpaceHeld(true)
        return
      }
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault()
        zoomBy(1)
      } else if (mod && e.key === "-") {
        e.preventDefault()
        zoomBy(-1)
      } else if (mod && e.key === "0") {
        e.preventDefault()
        resetZoom()
      } else if (mod && (e.key === "d" || e.key === "D") && !e.shiftKey && selectedId && showSelection) {
        e.preventDefault()
        onDuplicate(selectedId)
      } else if (mod) {
        return
      } else if (e.altKey && ARROWS[e.key]) {
        // the focused card, else the selected one
        const focused = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-drag]")?.dataset.drag : undefined
        const id = focused ?? (showSelection ? selectedId : null)
        if (!id || move.current?.active) return
        e.preventDefault()
        const step = GRID * (e.shiftKey ? 4 : 1)
        const [dx, dy] = ARROWS[e.key]
        const o = offsetOf(offsetsRef.current, id)
        onMove(id, { x: o.x + dx * step, y: o.y + dy * step }, true)
      } else if (e.shiftKey && (e.key === "!" || e.code === "Digit1")) {
        fitToView()
      } else if (e.key === "h" || e.key === "H") {
        setTool("hand")
      } else if (e.key === "v" || e.key === "V") {
        setTool("pointer")
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId && showSelection) {
        e.preventDefault()
        onDelete(selectedId)
      } else if (e.key === "Escape") {
        onSelect(null)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false)
    }
    const blur = () => setSpaceHeld(false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [zoomBy, resetZoom, fitToView, selectedId, showSelection, onDelete, onSelect, onDuplicate, onMove])

  /*
   * Mouse: drag a card to move it (past 3px; a click still selects); drag empty
   * canvas to pan (with the hand tool / Space, anything).
   * Touch: one finger pans from anywhere (a tap still selects), press and hold a
   * card to move it, two fingers pinch-zoom.
   */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as Element
    // React bubbles events through portals: ignore menus/sheets rendered outside the canvas DOM
    if (!e.currentTarget.contains(target)) return
    if (target.closest("[data-canvas-ui]")) return
    const touch = e.pointerType === "touch"
    // the card handle under the pointer — never the "…" menu, chip, "+" buttons or the rename field
    const handle =
      panMode || target.closest("input, [data-no-drag], [data-no-pan]")
        ? null
        : target.closest<HTMLElement>("[data-drag]")?.dataset.drag
    if (touch) {
      if (move.current?.active) return // a card is being dragged: other fingers don't pinch
      touches.current.set(e.pointerId, local(e.clientX, e.clientY))
      if (touches.current.size === 2) {
        // a second finger turns a pending long press into a pinch
        clearPress()
        move.current = null
        const [a, b] = [...touches.current.values()]
        pinch.current = {
          dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          view,
        }
        drag.current = null
        setPanning(true)
        return
      }
      if (touches.current.size > 2) return
    } else {
      if (target.closest("[data-no-pan]")) return
      if (e.button !== 0 && e.button !== 1) return
      if (e.button === 0 && handle) {
        press(e, handle, false)
        return
      }
      if (e.button === 0 && !panMode && target.closest("[data-block]")) return
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    drag.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: view.x,
      oy: view.y,
      moved: false,
      onEmpty: !target.closest("[data-block], [data-drag], [data-no-pan]"),
      touch,
    }
    if (touch && handle) press(e, handle, true)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = move.current
    if (m && m.pointer === e.pointerId) {
      m.last = { x: e.clientX, y: e.clientY, alt: e.altKey }
      if (m.active) {
        schedule(m)
        return
      }
      if (!m.touch) {
        if (Math.hypot(e.clientX - m.sx, e.clientY - m.sy) >= DRAG_THRESHOLD) activate(m)
        return
      }
      // touch before the long press fires: moving pans instead (below)
    }
    if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, local(e.clientX, e.clientY))
    const p = pinch.current
    if (p && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const z = clampZ((p.view.z * dist) / p.dist)
      // keep the world point under the starting midpoint under the fingers
      const wx = (p.mid.x - p.view.x) / p.view.z
      const wy = (p.mid.y - p.view.y) / p.view.z
      setView({ z, x: mid.x - wx * z, y: mid.y - wy * z })
      return
    }
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved && Math.hypot(dx, dy) < (d.touch ? 6 : 3)) return
    if (!d.moved) {
      d.moved = true
      setPanning(true)
      // moved before the long press: it's a pan, not a block drag
      if (m && !m.active) {
        clearPress()
        move.current = null
      }
      // touch captures only once it's a pan, so a tap still reaches the card / button
      if (d.touch) e.currentTarget.setPointerCapture(e.pointerId)
    }
    setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }))
  }
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = move.current
    if (m && m.pointer === e.pointerId) {
      if (m.active) {
        touches.current.delete(e.pointerId)
        drag.current = null
        if (e.type === "pointercancel") cancelMove()
        else drop(m, e)
        return
      }
      // released before it became a drag: a plain click / tap (the card selects itself)
      clearPress()
      move.current = null
    }
    touches.current.delete(e.pointerId)
    if (pinch.current) {
      if (touches.current.size < 2) {
        pinch.current = null
        setPanning(false)
      }
      return
    }
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (!d.moved && !panMode && d.onEmpty) onSelect(null) // plain click / tap on empty canvas
    drag.current = null
    setPanning(false)
  }

  return (
    <div
      ref={viewportRef}
      role="application"
      aria-label="Workflow canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // a long press on a card would otherwise open the touch context menu
      onContextMenu={(e) => {
        if (move.current?.touch) e.preventDefault()
      }}
      data-grabbing={preview ? "" : undefined}
      className={cn(
        "relative min-w-0 flex-1 touch-none overflow-hidden bg-(--aw-canvas) select-none",
        panMode && (panning ? "cursor-grabbing" : "cursor-grab"),
        !panMode && panning && "cursor-grabbing"
      )}
    >
      {/* Dot grid — Figma "216.reversible": 2px dots (#282828 @ 12%) every 18px */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <pattern
            id={gridId}
            width={GRID}
            height={GRID}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${view.x} ${view.y}) scale(${view.z})`}
          >
            <image href={ASSETS.dot} x={7} y={3} width={2} height={2} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${gridId})`} />
      </svg>

      {/* Transformable world layer */}
      <div
        data-moving={moving ? "" : undefined}
        className={cn(
          "aw-world absolute top-0 left-0 origin-top-left",
          panMode && "[&_[data-block]]:pointer-events-none [&_[data-drag]]:pointer-events-none [&_[data-no-pan]]:pointer-events-none"
        )}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
          willChange: panning ? "transform" : undefined,
        }}
      >
        {arranged.blocks.map((p) => {
          const block = blocks[p.id]
          const tab = block.kind === "trigger" ? TRIGGER_TAB_H : 0
          const end = endSlots.get(p.id)
          const dragging = preview?.id === p.id
          return (
            <div
              key={p.id}
              className="aw-node"
              data-enter={freshId === p.id || undefined}
              data-dragging={dragging || undefined}
              data-touch={(dragging && preview.touch) || undefined}
              style={{ transform: `translate(${p.x}px, ${p.y - tab}px)` }}
            >
              <BlockCard
                block={block}
                selected={showSelection && selectedId === p.id}
                onSelect={() => onSelect(p.id)}
                onRename={(title) => onRename(p.id, title)}
                onDuplicate={() => onDuplicate(p.id)}
                onDelete={() => onDelete(p.id)}
                moved={p.id in offsets}
                onResetPosition={() => onResetPosition(p.id)}
              />
              {/* "+" under the last block of a branch — revealed with its card */}
              {end ? <EndSlot top={tab + CARD_H} slot={end} onInsert={onInsert} /> : null}
            </div>
          )
        })}
        {/* connectors sit above the cards (Figma layer order): the handle overlaps the card edge */}
        {arranged.edges.map((edge) => (
          // a lifted card keeps its own port dot on top
          <Edge key={edge.key} edge={edge} lifted={preview?.id === edge.from} />
        ))}
        {arranged.slots.map((slot) =>
          slot.variant === "end" ? null : <InsertSlot key={slot.key} slot={slot} onInsert={onInsert} />
        )}
      </div>


      {arranged.blocks.length === 0 ? (
        <div className="aw-fade-in pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 pb-24 text-center">
          <p className="text-[14px] leading-none font-medium tracking-[-0.28px] text-(--aw-ink-2)">This workflow is empty</p>
          <p className="text-[14px] leading-none font-medium tracking-[-0.28px] text-(--aw-faint)">
            Undo the last delete to bring blocks back.
          </p>
        </div>
      ) : null}

      <CanvasToolbar
        zoom={view.z}
        tool={tool}
        onTool={setTool}
        onZoomIn={() => zoomBy(1)}
        onZoomOut={() => zoomBy(-1)}
        onReset={resetZoom}
        onFit={fitToView}
        canTidy={Object.keys(offsets).length > 0}
        onTidy={onTidy}
        outline={order.map((id) => blocks[id])}
        onJump={(id) => {
          onSelect(id)
          centreOn(id)
        }}
      />
    </div>
  )
}


/* ------------------------------------------------------------------- edges */

function Edge({ edge, lifted }: { edge: ArrangedEdge; lifted: boolean }) {
  const z = lifted ? 31 : undefined
  if (edge.kind === "routed") {
    // moved block: orthogonal route(s) with rounded corners, drawn in canvas coordinates
    return (
      <div className="aw-node pointer-events-none" style={{ zIndex: z }}>
        <svg aria-hidden width={1} height={1} overflow="visible" className="absolute top-0 left-0">
          {edge.paths.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="#C4C4C4"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </svg>
        {edge.labels.map((l) => (
          <BranchLabel
            key={l.text}
            label={l.text}
            style={{ left: l.x, top: l.y, transform: "translate(-50%, -50%)" }}
          />
        ))}
        <Asset
          src={ASSETS.branchHandle}
          w={14}
          h={14}
          className="absolute"
          style={{ left: edge.port.x - 7, top: edge.port.y - 7 }}
        />
      </div>
    )
  }
  if (edge.kind === "connector") {
    // Figma "Group 2147293429": handle dot + 46px line + arrowhead (14×53.5)
    return (
      <div className="aw-node pointer-events-none" style={{ transform: `translate(${edge.x}px, ${edge.y}px)`, zIndex: z }}>
        <Asset src={ASSETS.connector} w={14} h={53.5} />
      </div>
    )
  }
  // Figma "Group 2147293432": if/else split with "Is true" / "Is false" labels.
  // Drawn from the layout so nested branches can spread wider than Figma's 195px.
  const d = edge.spread
  const cx = CARD_W / 2
  const lx = cx - d - BRANCH.arrowOut
  const rx = cx + d + BRANCH.arrowOut
  const { barY: bar, tipY: tip } = BRANCH
  const arrow = (x: number) => `M${x - 3.18} ${tip - 3.18}L${x} ${tip}L${x + 3.18} ${tip - 3.18}`
  const shift = (d - BRANCH.spread) / 2
  return (
    <div className="aw-node pointer-events-none" style={{ transform: `translate(${edge.x}px, ${edge.y}px)`, zIndex: z }}>
      <svg aria-hidden width={1} height={1} overflow="visible" className="absolute top-0 left-0">
        <path
          d={`M${cx} ${CARD_H}V${bar}M${lx} ${bar}H${rx}M${lx} ${bar}V${tip}M${rx} ${bar}V${tip}${arrow(lx)}${arrow(rx)}`}
          stroke="#C4C4C4"
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <BranchLabel label="Is true" style={{ left: 11 - shift, top: 119 }} />
      <BranchLabel label="Is false" style={{ left: 214 + shift, top: 119 }} />
      <Asset src={ASSETS.branchHandle} w={14} h={14} className="absolute" style={{ left: 133, top: 86 }} />
    </div>
  )
}

function BranchLabel({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span className="absolute flex h-[22px] items-center rounded-[8px] bg-(--aw-line-card) p-1" style={style}>
      <span className="px-0.5 text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap text-(--aw-muted)">
        {label}
      </span>
    </span>
  )
}

/* ------------------------------------------------------------ insert slots */

function SlotButton({ label, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button type="button" aria-label={label} data-no-pan="" className="aw-slot" {...props}>
      <span className="aw-slot-dot">
        <Asset src={ASSETS.plus} w={12} h={12} />
      </span>
    </button>
  )
}

function slotLabel(slot: PlacedSlot) {
  if (slot.target.kind === "branch") return `Add a step to the ${slot.target.side === "true" ? "“Is true”" : "“Is false”"} branch`
  return slot.variant === "end" ? "Add a step at the end" : "Insert a step here"
}

/** "+" on a connector / branch drop (hover or focus to reveal), or the empty-branch pill. */
function InsertSlot({ slot, onInsert }: { slot: PlacedSlot; onInsert: CanvasProps["onInsert"] }) {
  if (slot.variant === "empty") {
    return (
      <div className="aw-node" style={{ transform: `translate(${slot.x}px, ${slot.y}px)` }}>
        <BlockPicker
          onPick={(t) => onInsert(slot.target, t)}
          trigger={
            <button
              type="button"
              data-no-pan=""
              aria-label={slotLabel(slot)}
              className="aw-btn aw-slot-empty absolute flex h-[30px] before:absolute before:-inset-[5px] before:content-[''] -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full pr-3 pl-2 whitespace-nowrap"
            >
              <Asset src={ASSETS.plus} w={14} h={14} />
              <span className="text-[13px] leading-none font-medium tracking-[-0.2px] text-(--aw-muted)">Add step</span>
            </button>
          }
        />
      </div>
    )
  }
  return (
    <div className="aw-node" style={{ transform: `translate(${slot.x - 20}px, ${slot.y - 20}px)` }}>
      <BlockPicker onPick={(t) => onInsert(slot.target, t)} trigger={<SlotButton label={slotLabel(slot)} />} />
    </div>
  )
}

/** Stub line + "+" under the last block of a branch; lives inside the card's node so card hover reveals it. */
function EndSlot({ top, slot, onInsert }: { top: number; slot: PlacedSlot; onInsert: CanvasProps["onInsert"] }) {
  return (
    <div className="aw-end absolute" style={{ left: CARD_W / 2 - 20, top }}>
      <span aria-hidden className="aw-end-stub absolute left-[19.5px] top-0 h-[15px] w-px bg-[#C4C4C4]" />
      <div className="absolute top-[6px] left-0">
        <BlockPicker onPick={(t) => onInsert(slot.target, t)} trigger={<SlotButton label={slotLabel(slot)} />} />
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- toolbar */

type ToolbarProps = {
  zoom: number
  tool: Tool
  onTool: (t: Tool) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFit: () => void
  /** something has been moved off the auto layout */
  canTidy: boolean
  onTidy: () => void
  outline: Blocks[string][]
  onJump: (id: string) => void
}

/** Figma 1:5028 — floating 20px-radius bar, #FCFCFC, centred 24px above the bottom. */
function CanvasToolbar({
  zoom,
  tool,
  onTool,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
  canTidy,
  onTidy,
  outline,
  onJump,
}: ToolbarProps) {
  const [outlineOpen, setOutlineOpen] = useState(false)

  return (
    <div
      data-canvas-ui
      className="absolute bottom-[calc(16px+env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[20px] border border-(--aw-line) bg-(--aw-toolbar) p-2.5 shadow-(--aw-shadow-toolbar) sm:bottom-6 sm:p-[15px]"
    >
      <ToolButton label="Zoom out" kbd="⌘−" onClick={onZoomOut} disabled={zoom <= MIN_Z + 0.001}>
        <Asset src={ASSETS.minus} w={14} h={14} />
      </ToolButton>
      <Tooltip>
        <TooltipTrigger
          onClick={onReset}
          aria-label={`Zoom ${Math.round(zoom * 100)}%, reset to 100%`}
          className="aw-hit relative flex h-[30px] min-w-[37px] cursor-pointer items-center justify-center rounded-[8px] px-0.5 font-(family-name:--aw-font-inter) text-[14px] leading-none font-medium tracking-[-0.28px] text-(--aw-muted) tabular-nums transition-colors duration-(--duration-press) hover:text-(--aw-ink-2)"
        >
          {Math.round(zoom * 100)}%
        </TooltipTrigger>
        <TooltipContent>Reset to 100% · ⌘0</TooltipContent>
      </Tooltip>
      <ToolButton label="Zoom in" kbd="⌘+" onClick={onZoomIn} disabled={zoom >= MAX_Z - 0.001}>
        <Asset src={ASSETS.plus} w={14} h={14} />
      </ToolButton>

      {/* Phones pan with a finger — the hand / select tools only take room there */}
      <div className="contents max-sm:hidden">
      <Asset src={ASSETS.divider} w={1} h={14} />

      <ToolToggle label="Hand tool" kbd="H" active={tool === "hand"} onClick={() => onTool("hand")}>
        <span
          aria-hidden
          className="sn-icon size-[14px]"
          style={{ maskImage: `url(${ASSETS.hand})`, WebkitMaskImage: `url(${ASSETS.hand})` }}
        />
      </ToolToggle>
      <ToolToggle label="Select tool" kbd="V" active={tool === "pointer"} onClick={() => onTool("pointer")}>
        <MousePointerClickIcon className="size-[14px]" strokeWidth={1.6} />
      </ToolToggle>
      </div>

      <Asset src={ASSETS.divider} w={1} h={14} />

      <Popover open={outlineOpen} onOpenChange={setOutlineOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                aria-label="Workflow outline"
                className="aw-btn aw-hit flex size-[30px] items-center justify-center"
                data-tool=""
              />
            }
          >
            <Asset src={ASSETS.doc} w={14} h={14} />
          </TooltipTrigger>
          <TooltipContent>Outline</TooltipContent>
        </Tooltip>
        <PopoverContent side="top" sideOffset={14} className="w-64 gap-1 p-1.5">
          <PopoverTitle className="px-2 pt-1.5 pb-1 font-(family-name:--aw-font-mono) text-[12px] font-medium tracking-[-0.36px] text-(--aw-label)">
            {outline.length} blocks
          </PopoverTitle>
          {outline.length === 0 ? (
            <p className="px-2 pb-2 text-[13px] text-(--aw-faint)">No blocks on the canvas.</p>
          ) : (
            outline.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setOutlineOpen(false)
                  onJump(b.id)
                }}
                className="aw-ghost flex h-[30px] w-full items-center gap-2 px-2 text-left"
              >
                <Tile tone={TONE_COLOR[b.tone]} size={16} radius={5} glyph={b.icon} glyphSize={8} variant="xs" />
                <span className="min-w-0 flex-1 truncate aw-clip-safe text-[13px] leading-none font-medium text-(--aw-ink-2)">
                  {b.title}
                </span>
                <span className="text-[12px] leading-none font-medium text-(--aw-faint)">{b.chip}</span>
              </button>
            ))
          )}
        </PopoverContent>
      </Popover>

      <Asset src={ASSETS.divider} w={1} h={14} />

      <ToolButton label="Fit to screen" kbd="⇧1" onClick={onFit}>
        <Asset src={ASSETS.rows} w={14} h={14} />
      </ToolButton>
      <ToolButton
        label={canTidy ? "Tidy up" : "Tidy up (nothing moved)"}
        onClick={onTidy}
        disabled={!canTidy}
      >
        <BroomSparklesIcon className="size-[14px] text-(--aw-faint)" strokeWidth={1.6} />
      </ToolButton>
    </div>
  )
}

function ToolButton({
  label,
  kbd,
  onClick,
  disabled,
  children,
}: {
  label: string
  kbd?: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        // the trigger's own `disabled` only turns the tooltip off: disable the button itself
        render={<button type="button" disabled={disabled} />}
        aria-label={label}
        onClick={onClick}
        data-tool=""
        className="aw-btn aw-hit flex size-[30px] shrink-0 items-center justify-center disabled:opacity-50"
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {kbd ? <span className="opacity-60"> · {kbd}</span> : null}
      </TooltipContent>
    </Tooltip>
  )
}

/** Hand / Select: the same white tool button, pressed grey with an ink icon while active. */
function ToolToggle({
  label,
  kbd,
  active,
  onClick,
  children,
}: {
  label: string
  kbd: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        data-tool=""
        className={cn(
          "aw-btn aw-hit flex size-[30px] shrink-0 items-center justify-center",
          active ? "text-(--aw-ink)" : "text-(--aw-faint)"
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label} <span className="opacity-60">· {kbd}</span>
      </TooltipContent>
    </Tooltip>
  )
}
