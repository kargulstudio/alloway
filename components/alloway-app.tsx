"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { INITIAL_BLOCKS, INITIAL_ROOT, INITIAL_SELECTED, templateFor, type BlockTemplate } from "@/lib/data"
import {
  changeBlockType,
  dropOffsets,
  duplicateBlock,
  insertBlock,
  longestPath,
  moveBlock,
  outcomesFor,
  removeBlock,
  updateBlock,
  type Graph,
  type InsertTarget,
  type Offset,
} from "@/lib/workflow"
import { useHistory } from "@/lib/use-history"
import { BREAKPOINTS, useMediaQuery } from "@/lib/use-media-query"
import { cn } from "@/lib/utils"
import { Sidebar } from "./sidebar"
import { TopBar, type View } from "./top-bar"
import { WorkflowCanvas } from "./workflow-canvas"
import { Inspector } from "./inspector"
import { RunsView } from "./runs-view"
import { Sheet } from "./sheet"

/**
 * Alloway workflow editor — Figma "Site Map" (1:516), 1440×1024.
 * ≥1024px: docked sidebar + canvas + inspector panel (the Figma layout).
 * Below: the sidebar is a drawer and the inspector a bottom sheet.
 */
export function AllowayApp() {
  const isDesktop = useMediaQuery(BREAKPOINTS.lg)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mobileOpen = drawerOpen && !isDesktop
  const [collapsed, setCollapsed] = useState(false)
  // keyboard toggles skip the collapse animation (never animate keyboard actions)
  const [instant, setInstant] = useState(false)
  const [view, setView] = useState<View>("editor")
  const [name, setName] = useState("Untitled")
  const [status, setStatus] = useState<"draft" | "live">("draft")
  const history = useHistory<Graph>({ blocks: INITIAL_BLOCKS, rootId: INITIAL_ROOT, offsets: {} })
  const { commit, current, revert, undo, redo } = history
  const graph = history.value
  // The frame opens with the inspector on "Find list entries" but no canvas
  // highlight; the highlight appears once the user picks a block themselves.
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL_SELECTED)
  const [showSelection, setShowSelection] = useState(false)
  const [freshId, setFreshId] = useState<string | null>(null)
  const [reveal, setReveal] = useState<{ id: string; n: number } | null>(null)

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    setShowSelection(id !== null)
  }, [])

  /** Select a block that just appeared, play its enter animation and pan it into view. */
  const focusNew = useCallback((id: string) => {
    setSelectedId(id)
    setShowSelection(true)
    setFreshId(id)
    setReveal((r) => ({ id, n: (r?.n ?? 0) + 1 }))
  }, [])

  /** Every edit goes through here: history + back to Draft. */
  const edit = useCallback(
    (next: Graph | ((g: Graph) => Graph), label: string, coalesce?: string) => {
      commit(next, label, coalesce)
      setStatus("draft")
    },
    [commit]
  )

  /* ⌘\ toggles the sidebar; ⌘Z / ⇧⌘Z (or Ctrl+Y) undo and redo workflow edits */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === "\\") {
        e.preventDefault()
        setInstant(true)
        if (isDesktop) setCollapsed((c) => !c)
        else setDrawerOpen((o) => !o)
        return
      }
      if (e.key === "Escape" && mobileOpen) {
        setDrawerOpen(false)
        return
      }
      const isUndo = mod && e.key.toLowerCase() === "z"
      const isRedo = (isUndo && e.shiftKey) || (e.ctrlKey && e.key.toLowerCase() === "y")
      if (!isUndo && !isRedo) return
      // text fields keep their own undo
      if (e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA"].includes(e.target.tagName))) return
      if (view !== "editor") return
      e.preventDefault()
      const label = isRedo ? redo() : undo()
      if (label === null) {
        toast(isRedo ? "Nothing to redo" : "Nothing to undo", { id: "history" })
        return
      }
      setStatus("draft")
      toast(`${isRedo ? "Redid" : "Undid"}: ${label}`, { id: "history" })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo, view, isDesktop, mobileOpen])

  const deleteBlock = useCallback(
    (id: string) => {
      const before = current()
      const block = before.blocks[id]
      if (!block) return
      if (block.kind === "trigger") {
        toast("The trigger can’t be removed", {
          id: "trigger-locked",
          description: "Change its event from the type chip in the inspector instead.",
        })
        return
      }
      const result = removeBlock(before.blocks, before.rootId, id)
      const after: Graph = {
        blocks: result.blocks,
        rootId: result.rootId,
        offsets: dropOffsets(before.offsets, result.removed),
      }
      const label = `Delete “${block.title}”`
      edit(after, label)
      select(null)
      const extra = result.removed.length - 1
      toast(`“${block.title}” deleted`, {
        description: extra > 0 ? `Its ${extra} branch block${extra > 1 ? "s were" : " was"} removed too.` : undefined,
        action: {
          label: "Undo",
          onClick: () => {
            revert(after, before, label)
            select(id)
          },
        },
      })
    },
    [current, edit, revert, select]
  )

  const insert = useCallback(
    (target: InsertTarget, template: BlockTemplate) => {
      const result = insertBlock(current(), target, template)
      if (!result.id) return
      edit(result.graph, `Add “${template.title}”`)
      focusNew(result.id)
    },
    [current, edit, focusNew]
  )

  const duplicate = useCallback(
    (id: string) => {
      const before = current()
      const block = before.blocks[id]
      const result = duplicateBlock(before, id)
      if (!block || !result.id) return
      const label = `Duplicate “${block.title}”`
      edit(result.graph, label)
      focusNew(result.id)
      toast(`Duplicated “${block.title}”`, {
        action: {
          label: "Undo",
          onClick: () => {
            revert(result.graph, before, label)
            select(id)
          },
        },
      })
    },
    [current, edit, focusNew, revert, select]
  )

  const updateDescription = useCallback(
    (id: string, value: string) => edit((g) => updateBlock(g, id, { description: value }), "Edit description", `desc:${id}`),
    [edit]
  )

  const updateTitle = useCallback(
    (id: string, value: string) => edit((g) => updateBlock(g, id, { title: value }), "Rename block", `title:${id}`),
    [edit]
  )

  /** Inline rename on the card — confirmed with a toast (the inspector edits live). */
  const renameBlock = useCallback(
    (id: string, title: string) => {
      if (!current().blocks[id]) return
      edit((g) => updateBlock(g, id, { title }), `Rename to “${title}”`)
      toast.success(`Renamed to “${title}”`, { id: "rename-block" })
    },
    [current, edit]
  )

  const changeType = useCallback(
    (id: string, template: BlockTemplate) => {
      const before = current()
      const block = before.blocks[id]
      if (!block || block.type === template.type) return
      const result = changeBlockType(before, id, template, templateFor(block.type))
      const label = `Change to ${template.title}`
      edit(result.graph, label)
      if (result.removed.length) {
        const n = result.removed.length
        toast(`Changed to ${template.title}`, {
          description: `Its “Is false” branch (${n} block${n > 1 ? "s" : ""}) was removed.`,
          action: { label: "Undo", onClick: () => revert(result.graph, before, label) },
        })
      }
    },
    [current, edit, revert]
  )

  /**
   * Drag a block to a new offset from its auto-layout position. Each drag is
   * one undo step; keyboard nudges on the same block merge (`nudge`).
   */
  const move = useCallback(
    (id: string, offset: Offset, nudge?: boolean) => {
      const block = current().blocks[id]
      if (!block) return
      edit((g) => moveBlock(g, id, offset), `Move “${block.title}”`, nudge ? `move:${id}` : undefined)
    },
    [current, edit]
  )

  const selected = selectedId ? (graph.blocks[selectedId] ?? null) : null
  const outcomes = useMemo(() => (selectedId ? outcomesFor(graph.blocks, selectedId) : []), [graph.blocks, selectedId])
  const blockCount = Object.keys(graph.blocks).length
  const stepCount = useMemo(() => longestPath(graph.blocks, graph.rootId), [graph])

  const sheetOpen = !isDesktop && view === "editor" && showSelection && !!selected
  const inspector = (layout: "panel" | "sheet") => (
    <Inspector
      layout={layout}
      block={selected}
      outcomes={outcomes}
      onBack={() => select(null)}
      onDescriptionChange={updateDescription}
      onTitleChange={updateTitle}
      onTypeChange={changeType}
      onDelete={deleteBlock}
      onInsert={insert}
    />
  )

  return (
    <div className="alloway flex h-dvh w-full overflow-hidden lg:min-h-[640px]">
      <Sidebar
        collapsed={collapsed && isDesktop}
        instant={instant}
        isDesktop={isDesktop}
        mobileOpen={mobileOpen}
        onToggle={() => {
          setInstant(false)
          setCollapsed((c) => !c)
        }}
        onCloseMobile={() => {
          setInstant(false)
          setDrawerOpen(false)
        }}
      />

      {/* Drawer scrim (below lg only) */}
      <div
        aria-hidden
        onClick={() => setDrawerOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-(--bg-overlay) transition-opacity duration-300 ease-drawer lg:hidden motion-reduce:transition-none",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          instant && "transition-none"
        )}
      />

      <div inert={mobileOpen} className="flex min-w-0 flex-1 flex-col">
        <TopBar
          name={name}
          onRename={setName}
          view={view}
          onViewChange={setView}
          status={status}
          blockCount={blockCount}
          onOpenMenu={() => {
            setInstant(false)
            setDrawerOpen(true)
          }}
          onPublish={() => {
            setStatus("live")
            toast.success(`“${name}” is live`, { description: `${blockCount} blocks published.` })
          }}
        />
        <main className="flex min-h-0 flex-1">
          {view === "editor" ? (
            <>
              <WorkflowCanvas
                blocks={graph.blocks}
                rootId={graph.rootId}
                offsets={graph.offsets}
                onMove={move}
                selectedId={selectedId}
                showSelection={showSelection}
                onSelect={select}
                onDelete={deleteBlock}
                onInsert={insert}
                onRename={renameBlock}
                onDuplicate={duplicate}
                freshId={freshId}
                reveal={reveal}
              />
              {/* ≥ lg: the Figma side panel. Hidden by CSS below, so SSR never flashes it on phones. */}
              <div className="hidden h-full lg:flex">{inspector("panel")}</div>
            </>
          ) : (
            <RunsView name={name} stepCount={stepCount} onOpenEditor={() => setView("editor")} />
          )}
        </main>
      </div>

      {/* < lg: the inspector is a bottom sheet that opens with a selected block */}
      {!isDesktop ? (
        <Sheet
          open={sheetOpen}
          onOpenChange={(open) => {
            if (!open) select(null)
          }}
          title={selected ? `${selected.title} settings` : "Block settings"}
          hideTitle
        >
          {inspector("sheet")}
        </Sheet>
      ) : null}
    </div>
  )
}
