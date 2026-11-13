"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { INITIAL_BLOCKS, INITIAL_ROOT, INITIAL_SELECTED } from "@/lib/data"
import { outcomesFor, removeBlock, type Blocks } from "@/lib/workflow"
import { Sidebar } from "./sidebar"
import { TopBar, type View } from "./top-bar"
import { WorkflowCanvas } from "./workflow-canvas"
import { Inspector } from "./inspector"
import { RunsView } from "./runs-view"

type Graph = { blocks: Blocks; rootId: string | null }

/** Alloway workflow editor — Figma "Site Map" (1:516), 1440×1024. */
export function AllowayApp() {
  const [collapsed, setCollapsed] = useState(false)
  const [view, setView] = useState<View>("editor")
  const [name, setName] = useState("Untitled")
  const [status, setStatus] = useState<"draft" | "live">("draft")
  const [graph, setGraph] = useState<Graph>({ blocks: INITIAL_BLOCKS, rootId: INITIAL_ROOT })
  // The frame opens with the inspector on "Find list entries" but no canvas
  // highlight; the highlight appears once the user picks a block themselves.
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL_SELECTED)
  const [showSelection, setShowSelection] = useState(false)
  const graphRef = useRef(graph)

  useEffect(() => {
    graphRef.current = graph
  }, [graph])

  /* ⌘\ toggles the sidebar */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault()
        setCollapsed((c) => !c)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    setShowSelection(id !== null)
  }, [])

  const deleteBlock = useCallback(
    (id: string) => {
      const before = graphRef.current
      const block = before.blocks[id]
      if (!block) return
      const result = removeBlock(before.blocks, before.rootId, id)
      setGraph({ blocks: result.blocks, rootId: result.rootId })
      setSelectedId(null)
      setShowSelection(false)
      setStatus("draft")
      const extra = result.removed.length - 1
      toast(`“${block.title}” deleted`, {
        description: extra > 0 ? `Its ${extra} branch block${extra > 1 ? "s were" : " was"} removed too.` : undefined,
        action: {
          label: "Undo",
          onClick: () => {
            setGraph(before)
            setSelectedId(id)
            setShowSelection(true)
          },
        },
      })
    },
    []
  )

  const updateDescription = useCallback((id: string, value: string) => {
    setGraph((g) => (g.blocks[id] ? { ...g, blocks: { ...g.blocks, [id]: { ...g.blocks[id], description: value } } } : g))
    setStatus("draft")
  }, [])

  const selected = selectedId ? (graph.blocks[selectedId] ?? null) : null
  const outcomes = useMemo(() => (selectedId ? outcomesFor(graph.blocks, selectedId) : []), [graph.blocks, selectedId])
  const blockCount = Object.keys(graph.blocks).length

  return (
    <div className="alloway flex h-dvh min-h-[640px] w-full overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
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
              />
              <Inspector
                block={selected}
                outcomes={outcomes}
                onBack={() => select(null)}
                onDescriptionChange={updateDescription}
                onDelete={deleteBlock}
              />
            </>
          ) : (
            <RunsView name={name} onOpenEditor={() => setView("editor")} />
          )}
        </main>
      </div>
    </div>
  )
}
