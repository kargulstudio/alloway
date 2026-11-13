"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { INITIAL_BLOCKS, INITIAL_ROOT, INITIAL_SELECTED, templateFor, type BlockTemplate } from "@/lib/data"
import {
  changeBlockType,
  duplicateBlock,
  insertBlock,
  longestPath,
  outcomesFor,
  removeBlock,
  updateBlock,
  type Graph,
  type InsertTarget,
} from "@/lib/workflow"
import { useHistory } from "@/lib/use-history"
import { Sidebar } from "./sidebar"
import { TopBar, type View } from "./top-bar"
import { WorkflowCanvas } from "./workflow-canvas"
import { Inspector } from "./inspector"
import { RunsView } from "./runs-view"

/** Alloway workflow editor — Figma "Site Map" (1:516), 1440×1024. */
export function AllowayApp() {
  const [collapsed, setCollapsed] = useState(false)
  // keyboard toggles skip the collapse animation (never animate keyboard actions)
  const [instant, setInstant] = useState(false)
  const [view, setView] = useState<View>("editor")
  const [name, setName] = useState("Untitled")
  const [status, setStatus] = useState<"draft" | "live">("draft")
  const history = useHistory<Graph>({ blocks: INITIAL_BLOCKS, rootId: INITIAL_ROOT })
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
        setCollapsed((c) => !c)
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
  }, [undo, redo, view])

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
      const after: Graph = { blocks: result.blocks, rootId: result.rootId }
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

  const selected = selectedId ? (graph.blocks[selectedId] ?? null) : null
  const outcomes = useMemo(() => (selectedId ? outcomesFor(graph.blocks, selectedId) : []), [graph.blocks, selectedId])
  const blockCount = Object.keys(graph.blocks).length
  const stepCount = useMemo(() => longestPath(graph.blocks, graph.rootId), [graph])

  return (
    <div className="alloway flex h-dvh min-h-[640px] w-full overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        instant={instant}
        onToggle={() => {
          setInstant(false)
          setCollapsed((c) => !c)
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          name={name}
          onRename={setName}
          view={view}
          onViewChange={setView}
          status={status}
          blockCount={blockCount}
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
              <Inspector
                block={selected}
                outcomes={outcomes}
                onBack={() => select(null)}
                onDescriptionChange={updateDescription}
                onTitleChange={updateTitle}
                onTypeChange={changeType}
                onDelete={deleteBlock}
                onInsert={insert}
              />
            </>
          ) : (
            <RunsView name={name} stepCount={stepCount} onOpenEditor={() => setView("editor")} />
          )}
        </main>
      </div>
    </div>
  )
}
