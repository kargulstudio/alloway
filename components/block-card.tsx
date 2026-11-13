"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ASSETS, TONE_COLOR, type Block } from "@/lib/data"
import { Asset, Tile } from "./asset"

type BlockCardProps = {
  block: Block
  selected: boolean
  onSelect: () => void
  onRename: (title: string) => void
}

const TITLE = "text-[14px] leading-none font-medium tracking-[-0.28px] text-(--aw-ink-2)"

/**
 * Figma 1:5055 / 1:5075 … — 280×93 card, 12px radius, 1px #ECECEC ring.
 * The trigger carries the teal "Trigger" tab above it (83×26).
 * Double-click the title (or press F2 on a focused card) to rename it inline.
 */
export function BlockCard({ block, selected, onSelect, onRename }: BlockCardProps) {
  const isTrigger = block.kind === "trigger"
  const [editing, setEditing] = useState(false)

  return (
    <div className="flex w-[280px] flex-col items-start">
      {isTrigger ? (
        <div className="flex h-[26px] items-center gap-1 rounded-t-[8px] border border-(--aw-line-card) bg-(--aw-teal-soft) px-[7px] py-[5px]">
          <Asset src={ASSETS.stars} w={14} h={14} />
          <span className="px-0.5 text-[14px] leading-none font-medium tracking-[-0.28px] text-(--aw-teal)">Trigger</span>
        </div>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        data-block={block.id}
        data-selected={selected || undefined}
        aria-pressed={selected}
        aria-label={`${block.title} block`}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect()
          } else if (e.key === "F2") {
            e.preventDefault()
            setEditing(true)
          }
        }}
        className={cn(
          "aw-card flex h-[93px] w-[280px] flex-col justify-center gap-3 overflow-hidden p-4 outline-none",
          isTrigger ? "rounded-tr-[12px] rounded-b-[12px]" : "rounded-[12px]"
        )}
      >
        <div className="flex w-full items-center gap-2 border-b border-(--aw-line-card) pb-3">
          <Tile tone={TONE_COLOR[block.tone]} size={20} radius={6} glyph={block.icon} glyphSize={10} />
          {editing ? (
            <TitleInput
              initial={block.title}
              onDone={(title) => {
                setEditing(false)
                if (title !== null) onRename(title)
              }}
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
              title="Double-click to rename"
              className={cn("min-w-0 flex-1 truncate aw-clip-safe", TITLE)}
            >
              {block.title}
            </span>
          )}
          <span className="flex h-[22px] shrink-0 items-center rounded-[8px] bg-(--aw-chip) p-1">
            <span className="px-0.5 text-[14px] leading-none font-medium tracking-[-0.28px] whitespace-nowrap text-(--aw-muted)">
              {block.chip}
            </span>
          </span>
        </div>
        <p className="w-full truncate aw-clip-safe text-[14px] leading-none font-medium tracking-[-0.28px] text-(--aw-muted)">
          {block.description.trim() || "No description"}
        </p>
      </div>
    </div>
  )
}

/** Inline title editor. Enter / blur saves, Escape cancels (`null`). */
function TitleInput({ initial, onDone }: { initial: string; onDone: (title: string | null) => void }) {
  const [value, setValue] = useState(initial)
  const done = useRef(false)
  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    const next = value.trim()
    onDone(save && next && next !== initial ? next : null)
  }
  return (
    <input
      autoFocus
      aria-label="Block title"
      value={value}
      maxLength={60}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // keep Enter / Space / Delete away from the card and the canvas shortcuts
        e.stopPropagation()
        if (e.key === "Enter") finish(true)
        else if (e.key === "Escape") finish(false)
      }}
      className={cn(
        "-my-1 -ml-1 h-[22px] min-w-0 flex-1 rounded-[6px] bg-white px-1 outline-none",
        "shadow-[0_0_0_1px_var(--aw-teal),0_0_0_3px_rgba(20,179,152,0.12)]",
        TITLE
      )}
    />
  )
}
