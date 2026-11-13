"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { MousePointerClickIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { ASSETS, TONE_COLOR, type BlockTemplate } from "@/lib/data"
import {
  boundsOf,
  BRANCH,
  CANVAS_FRAME,
  CARD_H,
  CARD_W,
  layoutWorkflow,
  orderedIds,
  TRIGGER_TAB_H,
  type Blocks,
  type InsertTarget,
  type Layout,
  type PlacedEdge,
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
function fitView(layout: Layout, w: number, h: number): Viewport | null {
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

type CanvasProps = {
  blocks: Blocks
  rootId: string | null
  selectedId: string | null
  showSelection: boolean
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
  onInsert: (target: InsertTarget, template: BlockTemplate) => void
  onRename: (id: string, title: string) => void
  onDuplicate: (id: string) => void
  /** block that just appeared (plays the enter animation) */
  freshId: string | null
  /** bump `n` to pan a block into view */
  reveal: { id: string; n: number } | null
}

/** Figma 1:643 — #FAFAFA canvas with an 18px dot grid; nodes on a pan/zoom layer. */
export function WorkflowCanvas({
  blocks,
  rootId,
  selectedId,
  showSelection,
  onSelect,
  onDelete,
  onInsert,
  onRename,
  onDuplicate,
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

  const layout = useMemo(() => layoutWorkflow(blocks, rootId), [blocks, rootId])
  const layoutRef = useRef(layout)
  useEffect(() => {
    layoutRef.current = layout
  }, [layout])
  const order = useMemo(() => orderedIds(blocks, rootId), [blocks, rootId])
  const endSlots = useMemo(
    () => new Map(layout.slots.filter((s) => s.variant === "end").map((s) => [s.from, s])),
    [layout]
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
      centred.current = true
      const { width: w, height: h } = entry.contentRect
      const fit = window.matchMedia(BREAKPOINTS.lg).matches ? null : fitView(layoutRef.current, w, h)
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
    const fit = fitView(layout, w, h)
    if (fit) setView(fit)
  }, [layout, size])

  const centreOn = useCallback(
    (id: string) => {
      const p = layout.blocks.find((b) => b.id === id)
      if (!p) return
      const { w, h } = size()
      setView((v) => ({ ...v, x: w / 2 - (p.x + CARD_W / 2) * v.z, y: (h - 80) / 2 - (p.y + CARD_H / 2) * v.z }))
    },
    [layout, size]
  )

  /* Pan just enough to bring a new / jumped-to block fully into view. */
  useEffect(() => {
    if (!reveal) return
    const frame = requestAnimationFrame(() => {
      const p = layoutRef.current.blocks.find((b) => b.id === reveal.id)
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

  /* Keyboard: H / V tools, hold Space to pan, ⌘± / ⌘0 zoom, ⇧1 fit, ⌫ delete, ⌘D duplicate, Esc deselect. */
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
  }, [zoomBy, resetZoom, fitToView, selectedId, showSelection, onDelete, onSelect, onDuplicate])

  /*
   * Mouse: drag empty canvas to pan (with the hand tool / Space, anything).
   * Touch: one finger pans from anywhere (a tap still selects), two fingers pinch-zoom.
   */
  const local = (x: number, y: number) => {
    const r = viewportRef.current?.getBoundingClientRect()
    return { x: x - (r?.left ?? 0), y: y - (r?.top ?? 0) }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as Element
    // React bubbles events through portals: ignore menus/sheets rendered outside the canvas DOM
    if (!e.currentTarget.contains(target)) return
    if (target.closest("[data-canvas-ui]")) return
    const touch = e.pointerType === "touch"
    if (touch) {
      touches.current.set(e.pointerId, local(e.clientX, e.clientY))
      if (touches.current.size === 2) {
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
      onEmpty: !target.closest("[data-block], [data-no-pan]"),
      touch,
    }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
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
      // touch captures only once it's a pan, so a tap still reaches the card / button
      if (d.touch) e.currentTarget.setPointerCapture(e.pointerId)
    }
    setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }))
  }
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
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
            width={18}
            height={18}
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
        className={cn("absolute top-0 left-0 origin-top-left", panMode && "[&_[data-block]]:pointer-events-none [&_[data-no-pan]]:pointer-events-none")}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
          willChange: panning ? "transform" : undefined,
        }}
      >
        {layout.blocks.map((p) => {
          const block = blocks[p.id]
          const tab = block.kind === "trigger" ? TRIGGER_TAB_H : 0
          const end = endSlots.get(p.id)
          return (
            <div
              key={p.id}
              className="aw-node"
              data-enter={freshId === p.id || undefined}
              style={{ transform: `translate(${p.x}px, ${p.y - tab}px)` }}
            >
              <BlockCard
                block={block}
                selected={showSelection && selectedId === p.id}
                onSelect={() => onSelect(p.id)}
                onRename={(title) => onRename(p.id, title)}
                onDuplicate={() => onDuplicate(p.id)}
                onDelete={() => onDelete(p.id)}
              />
              {/* "+" under the last block of a branch — revealed with its card */}
              {end ? <EndSlot top={tab + CARD_H} slot={end} onInsert={onInsert} /> : null}
            </div>
          )
        })}
        {/* connectors sit above the cards (Figma layer order): the handle overlaps the card edge */}
        {layout.edges.map((edge) => (
          <Edge key={edge.key} edge={edge} />
        ))}
        {layout.slots.map((slot) =>
          slot.variant === "end" ? null : <InsertSlot key={slot.key} slot={slot} onInsert={onInsert} />
        )}
      </div>

      {layout.blocks.length === 0 ? (
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

function Edge({ edge }: { edge: PlacedEdge }) {
  if (edge.kind === "connector") {
    // Figma "Group 2147293429": handle dot + 46px line + arrowhead (14×53.5)
    return (
      <div className="aw-node pointer-events-none" style={{ transform: `translate(${edge.x}px, ${edge.y}px)` }}>
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
    <div className="aw-node pointer-events-none" style={{ transform: `translate(${edge.x}px, ${edge.y}px)` }}>
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
      <BranchLabel label="Is true" left={11 - shift} />
      <BranchLabel label="Is false" left={214 + shift} />
      <Asset src={ASSETS.branchHandle} w={14} h={14} className="absolute" style={{ left: 133, top: 86 }} />
    </div>
  )
}

function BranchLabel({ label, left }: { label: string; left: number }) {
  return (
    <span className="absolute flex h-[22px] items-center rounded-[8px] bg-(--aw-line-card) p-1" style={{ left, top: 119 }}>
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
  outline: Blocks[string][]
  onJump: (id: string) => void
}

/** Figma 1:5028 — floating 20px-radius bar, #FCFCFC, centred 24px above the bottom. */
function CanvasToolbar({ zoom, tool, onTool, onZoomIn, onZoomOut, onReset, onFit, outline, onJump }: ToolbarProps) {
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

      {tool === "hand" ? (
        <ActiveTool label="Hand tool" kbd="H">
          <Asset src={ASSETS.hand} w={14} h={14} className="brightness-0 invert" />
        </ActiveTool>
      ) : (
        <ToolButton label="Hand tool" kbd="H" onClick={() => onTool("hand")}>
          <Asset src={ASSETS.hand} w={14} h={14} />
        </ToolButton>
      )}

      {tool === "pointer" ? (
        <Tooltip>
          <TooltipTrigger
            aria-label="Select tool"
            aria-pressed
            className="relative size-[30px] shrink-0 cursor-pointer rounded-[10px]"
          >
            {/* Figma 1:5043 — active tool tile, exported with its shadows (38×38, offset −4/−2) */}
            <Asset src={ASSETS.pointerActive} w={38} h={38} className="absolute top-[-2px] left-[-4px]" />
          </TooltipTrigger>
          <TooltipContent>Select · V</TooltipContent>
        </Tooltip>
      ) : (
        <ToolButton label="Select tool" kbd="V" onClick={() => onTool("pointer")}>
          <MousePointerClickIcon className="size-[14px] text-(--aw-faint)" strokeWidth={1.6} />
        </ToolButton>
      )}
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
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
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

function ActiveTool({ label, kbd, children }: { label: string; kbd: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        aria-pressed
        className="aw-btn-dark flex size-[30px] shrink-0 items-center justify-center"
      >
        <Asset src={ASSETS.publishGlow} w={196} h={62} className="pointer-events-none absolute top-[-35px] left-[-83px] -z-10" />
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label} <span className="opacity-60">· {kbd}</span>
      </TooltipContent>
    </Tooltip>
  )
}
