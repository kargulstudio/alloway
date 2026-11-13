"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ASSETS, TONE_COLOR, type Block } from "@/lib/data"
import type { Outcome } from "@/lib/workflow"
import { Asset, Tile } from "./asset"

const SECTION = "flex w-full shrink-0 flex-col bg-white shadow-[inset_1px_0_0_var(--aw-line),inset_0_-1px_0_var(--aw-line)]"
const TEXT = "text-[14px] leading-none font-medium tracking-[-0.28px]"

type InspectorProps = {
  block: Block | null
  outcomes: Outcome[]
  onBack: () => void
  onDescriptionChange: (id: string, value: string) => void
  onDelete: (id: string) => void
}

/** Figma 1:5144 — 320px right panel: header · block · inputs · next step · actions. */
export function Inspector({ block, outcomes, onBack, onDescriptionChange, onDelete }: InspectorProps) {
  const [nonce, setNonce] = useState(0)

  return (
    <aside aria-label="Block inspector" className="flex h-full w-(--aw-inspector) shrink-0 flex-col bg-white">
      {/* 1:5145 */}
      <div className={cn(SECTION, "h-[54px] justify-center px-4 py-3")}>
        <Tooltip>
          <TooltipTrigger
            onClick={onBack}
            disabled={!block}
            aria-label="Close block"
            className="aw-btn flex size-[30px] items-center justify-center disabled:opacity-50"
          >
            <Asset src={ASSETS.chevronLeft} w={14} h={14} />
          </TooltipTrigger>
          <TooltipContent side="bottom">Back to workflow · Esc</TooltipContent>
        </Tooltip>
      </div>

      {block ? (
        <InspectorBody
          key={`${block.id}:${nonce}`}
          block={block}
          outcomes={outcomes}
          onRefresh={() => setNonce((n) => n + 1)}
          onDescriptionChange={onDescriptionChange}
          onDelete={onDelete}
        />
      ) : (
        <div className={cn(SECTION, "aw-fade-in flex-1 items-center justify-center gap-1.5 p-6 text-center")}>
          <p className={cn(TEXT, "text-(--aw-ink)")}>No block selected</p>
          <p className={cn(TEXT, "leading-[1.4] text-(--aw-faint)")}>
            Click a block on the canvas to edit its description, inputs and next step.
          </p>
        </div>
      )}
    </aside>
  )
}

function InspectorBody({
  block,
  outcomes,
  onRefresh,
  onDescriptionChange,
  onDelete,
}: {
  block: Block
  outcomes: Outcome[]
  onRefresh: () => void
  onDescriptionChange: (id: string, value: string) => void
  onDelete: (id: string) => void
}) {
  // Inputs + outcomes "load" every time a block is opened or refreshed.
  const [inputsReady, setInputsReady] = useState(false)
  const [outcomesReady, setOutcomesReady] = useState(false)
  useEffect(() => {
    const a = window.setTimeout(() => setInputsReady(true), 1100)
    const b = window.setTimeout(() => setOutcomesReady(true), 1500)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [])
  const loading = !inputsReady || !outcomesReady
  const tone = TONE_COLOR[block.tone]

  return (
    <>
      {/* 1:5150 — identity + description */}
      <div className={cn(SECTION, "gap-4 p-4")}>
        <div className="flex w-full items-center gap-2.5">
          <Tile tone={tone} size={30} radius={10} glyph={block.inspectorIcon.lg} glyphSize={14} />
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <h2 className="truncate aw-clip-safe text-[16px] leading-none font-medium tracking-[-0.32px] text-(--aw-ink)">{block.title}</h2>
            <span className="flex h-5 shrink-0 items-center rounded-[6px] bg-(--aw-chip) p-1">
              <span className="px-0.5 text-[12px] leading-none font-medium tracking-[-0.24px] text-(--aw-muted)">
                {block.app}
              </span>
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger
              onClick={onRefresh}
              disabled={loading}
              aria-label="Reload block"
              data-raised=""
              className="aw-btn flex size-[30px] items-center justify-center"
            >
              <Asset src={ASSETS.refreshHeader} w={14} h={14} />
            </TooltipTrigger>
            <TooltipContent side="bottom">Reload inputs</TooltipContent>
          </Tooltip>
        </div>
        <textarea
          aria-label="Block description"
          placeholder="Add a description..."
          value={block.description}
          onChange={(e) => onDescriptionChange(block.id, e.target.value)}
          className={cn("aw-input h-20 w-full resize-none p-3 text-(--aw-ink-2)", TEXT, "leading-[1.3]")}
        />
      </div>

      {/* 1:5165 — inputs */}
      <div className={cn(SECTION, "gap-4 p-4")}>
        <p className={cn(TEXT, "text-(--aw-ink)")}>Inputs</p>
        {inputsReady ? (
          <dl className="aw-fade-in flex h-[120px] w-full flex-col overflow-hidden rounded-[10px] bg-white shadow-(--aw-shadow-btn)">
            {block.inputs.map((input, i) => (
              <div
                key={input.label}
                className={cn(
                  "flex h-10 items-center justify-between gap-3 px-3",
                  i > 0 && "shadow-[inset_0_1px_0_var(--aw-line)]"
                )}
              >
                <dt className="text-[13px] leading-none font-medium tracking-[-0.2px] text-(--aw-muted)">{input.label}</dt>
                <dd className="truncate aw-clip-safe text-[13px] leading-none font-medium tracking-[-0.2px] text-(--aw-ink-2)">
                  {input.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="flex h-[120px] w-full items-center justify-center rounded-[10px] border border-dashed border-(--aw-line) bg-(--aw-canvas) p-3">
            <Loading label="Loading inputs" />
          </div>
        )}
      </div>

      {/* 1:5174 — next step */}
      <div className={cn(SECTION, "min-h-0 flex-1 gap-4 overflow-y-auto p-4")}>
        <div className="flex flex-col gap-1.5">
          <p className={cn(TEXT, "text-(--aw-ink)")}>Next step</p>
          <p className={cn(TEXT, "text-(--aw-faint)")}>Add the next block in this workflow</p>
        </div>
        <div className="flex w-full flex-col gap-0.5">
          <div className="flex w-full items-center gap-2 rounded-[10px] bg-white px-3 py-2 shadow-(--aw-shadow-btn)">
            <Tile tone={tone} size={14} radius={4.2} glyph={block.inspectorIcon.sm} glyphSize={8.4} variant="xxs" />
            <span className={cn(TEXT, "truncate aw-clip-safe text-(--aw-ink-2)")}>{block.title}</span>
          </div>
          {outcomesReady ? (
            outcomes.map((o) => (
              <div key={o.label} className="aw-fade-in flex w-full items-end">
                <Asset src={ASSETS.treeBranch} w={37} h={34} />
                <div className="flex min-w-0 items-center gap-1.5 pb-0.5">
                  <span className="flex h-5 shrink-0 items-center rounded-[6px] bg-(--aw-chip) p-1">
                    <span className="px-0.5 text-[12px] leading-none font-medium tracking-[-0.24px] text-(--aw-muted)">
                      {o.label}
                    </span>
                  </span>
                  <span className={cn(TEXT, "truncate aw-clip-safe", o.target ? "text-(--aw-ink-2)" : "text-(--aw-faint)")}>
                    {o.target ? `→ ${o.target}` : "End of workflow"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex w-full items-end">
              <Asset src={ASSETS.treeBranch} w={37} h={34} />
              <div className="pb-0.5">
                <Loading label="Loading outcomes" gap={4} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1:5194 — actions */}
      <div className={cn(SECTION, "h-[54px] flex-row items-center gap-2 px-4 py-3")}>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={cn(
            "aw-btn flex h-[30px] min-w-0 flex-1 items-center justify-center gap-1 p-2",
            TEXT,
            loading ? "text-(--aw-faint)" : "text-(--aw-muted)"
          )}
        >
          <Asset src={ASSETS.refresh} w={14} h={14} />
          Refresh block
        </button>
        <button
          type="button"
          onClick={() => onDelete(block.id)}
          className={cn("aw-btn flex h-[30px] min-w-0 flex-1 items-center justify-center gap-1 p-2 text-(--aw-danger)", TEXT, "hover:bg-(--aw-danger-soft)!")}
        >
          <Asset src={ASSETS.trash} w={14} h={14} />
          Delete block
        </button>
      </div>
    </>
  )
}

function Loading({ label, gap = 8 }: { label: string; gap?: number }) {
  return (
    <span role="status" className="flex items-center" style={{ gap }}>
      <Asset src={ASSETS.spinner} w={14} h={14} className="aw-spin" />
      <span className={cn(TEXT, "text-(--aw-faint)")}>{label}</span>
    </span>
  )
}
