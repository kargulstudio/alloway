"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CheckIcon, CopyIcon, EllipsisIcon, LinkIcon, PencilLineIcon, PlayIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { ASSETS, RECENT_WORKFLOWS } from "@/lib/data"
import { Asset, Tile } from "./asset"

export type View = "editor" | "runs"

type TopBarProps = {
  name: string
  onRename: (name: string) => void
  view: View
  onViewChange: (v: View) => void
  status: "draft" | "live"
  blockCount: number
  onPublish: () => void
  /** opens the sidebar drawer (below lg) */
  onOpenMenu: () => void
}

const SHARE_LINK = "https://app.alloway.com/w/untitled-7f3k"

async function copyShareLink() {
  try {
    await navigator.clipboard?.writeText(SHARE_LINK)
  } catch {
    /* clipboard may be blocked — the toast still confirms intent */
  }
  toast.success("Link copied to clipboard")
}

/**
 * Figma 1:613 — 62px bar; selector · Editor/Runs · Draft | Share · Published.
 * Below lg a menu button opens the sidebar drawer; below md Draft/Share/Publish
 * fold into a "…" menu so the name and the view toggle keep their room.
 */
export function TopBar({ name, onRename, view, onViewChange, status, blockCount, onPublish, onOpenMenu }: TopBarProps) {
  const [anyone, setAnyone] = useState(true)
  const toggleAnyone = (v: boolean) => {
    setAnyone(v)
    toast(v ? "Workspace access on" : "Only invited people can view")
  }

  return (
    <header className="flex h-(--aw-header) shrink-0 items-center justify-between gap-2 bg-white px-3 py-3 shadow-[inset_0_-1px_0_var(--aw-line)] md:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onOpenMenu}
          className="aw-btn flex size-10 shrink-0 items-center justify-center lg:hidden"
        >
          <Asset src={ASSETS.menu} w={14} h={14} />
        </button>
        <WorkflowSelector name={name} onRename={onRename} />
      </div>
      <ViewToggle view={view} onChange={onViewChange} />
      <div className="hidden items-center gap-2 md:flex">
        <StatusBadge status={status} />
        <Asset src={ASSETS.divider} w={1} h={14} />
        <ShareButton name={name} anyone={anyone} onAnyoneChange={toggleAnyone} />
        <PublishButton name={name} status={status} blockCount={blockCount} onPublish={onPublish} />
      </div>
      <MoreMenu status={status} blockCount={blockCount} anyone={anyone} onAnyoneChange={toggleAnyone} onPublish={onPublish} />
    </header>
  )
}

/** Phones: Draft/Live, Publish and Share in one "…" menu. */
function MoreMenu({
  status,
  blockCount,
  anyone,
  onAnyoneChange,
  onPublish,
}: {
  status: "draft" | "live"
  blockCount: number
  anyone: boolean
  onAnyoneChange: (v: boolean) => void
  onPublish: () => void
}) {
  const live = status === "live"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Workflow actions" className="aw-btn relative flex size-10 shrink-0 items-center justify-center md:hidden">
        <EllipsisIcon className="size-4 text-(--aw-muted)" strokeWidth={1.75} />
        {/* unpublished changes */}
        {!live ? <span aria-hidden className="absolute top-2 right-2 size-1.5 rounded-full bg-(--aw-teal)" /> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", live ? "bg-(--aw-teal)" : "bg-(--aw-faint)")} />
            {live ? `Live · ${blockCount} blocks` : `Draft · ${blockCount} blocks`}
          </DropdownMenuLabel>
          <DropdownMenuItem className="min-h-10" disabled={live} onClick={onPublish}>
            <PlayIcon className="text-(--aw-faint)" />
            {live ? "Everything is live" : "Publish changes"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="min-h-10" onClick={copyShareLink}>
            <LinkIcon className="text-(--aw-faint)" />
            Copy share link
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem className="min-h-10" checked={anyone} onCheckedChange={onAnyoneChange}>
            Workspace can view
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ---------------------------------------------------------------- selector */

function WorkflowSelector({ name, onRename }: { name: string; onRename: (n: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  const commit = () => {
    const next = draft.trim()
    setEditing(false)
    if (next && next !== name) {
      onRename(next)
      toast.success(`Renamed to “${next}”`)
    } else setDraft(name)
  }

  if (editing) {
    return (
      <div className="aw-btn flex h-10 min-w-0 items-center gap-2 p-2 md:h-9 shadow-[0_0_0_1px_var(--aw-teal),0_0_0_4px_rgba(20,179,152,0.12)]">
        <Tile tone="#14b398" size={20} radius={6} glyph={ASSETS.fileTeal12} glyphSize={12} />
        <input
          autoFocus
          aria-label="Workflow name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") {
              setDraft(name)
              setEditing(false)
            }
          }}
          className="w-[160px] min-w-0 bg-transparent text-[14px] leading-none font-medium tracking-[-0.28px] text-(--aw-ink-2) outline-none"
        />
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="aw-btn flex h-10 max-w-[280px] min-w-0 items-center gap-2 p-2 md:h-9">
        <Tile tone="#14b398" size={20} radius={6} glyph={ASSETS.fileTeal12} glyphSize={12} />
        <span className="truncate aw-clip-safe text-[14px] leading-none font-medium tracking-[-0.28px] text-(--aw-ink-2)">{name}</span>
        <Asset src={ASSETS.chevronDown} w={14} h={14} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" sideOffset={6}>
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              setDraft(name)
              setEditing(true)
            }}
          >
            <PencilLineIcon className="text-(--aw-faint)" />
            Rename workflow
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CopyIcon className="text-(--aw-faint)" />
            Duplicate
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Recent workflows</DropdownMenuLabel>
          <DropdownMenuItem>
            <CheckIcon className="text-(--aw-teal)" />
            {name}
          </DropdownMenuItem>
          {RECENT_WORKFLOWS.map((w) => (
            <DropdownMenuItem key={w} className="pl-[34px]">
              {w}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ------------------------------------------------------------ view toggle */

const VIEWS: { id: View; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "runs", label: "Runs" },
]

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const el = refs.current[view]
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth })
  }, [view])

  return (
    <div role="tablist" aria-label="View" className="relative flex items-center gap-0.5 rounded-[10px] bg-(--aw-segment)">
      {/* sliding active pill (white, 1px ring) */}
      <span
        aria-hidden
        className={cn(
          "absolute top-0 h-[30px] rounded-[10px] bg-white shadow-(--aw-ring)",
          "transition-[left,width] duration-(--duration-base) ease-(--ease-out) motion-reduce:transition-none",
          !pill && "opacity-0"
        )}
        style={pill ?? undefined}
      />
      {VIEWS.map((v) => (
        <button
          key={v.id}
          ref={(el) => {
            refs.current[v.id] = el
          }}
          role="tab"
          type="button"
          aria-selected={view === v.id}
          onClick={() => onChange(v.id)}
          className={cn(
            "aw-hit relative flex h-[30px] cursor-pointer items-center justify-center rounded-[10px] p-2 text-[14px] leading-none font-medium tracking-[-0.21px]",
            "transition-colors duration-(--duration-press) ease-(--ease-out)",
            view === v.id ? "text-(--aw-ink)" : "text-(--aw-muted) hover:text-(--aw-ink-2)",
            // before the pill is measured (SSR / first paint) the active tab paints its own surface
            !pill && view === v.id && "bg-white shadow-(--aw-ring)"
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------- status */

function StatusBadge({ status }: { status: "draft" | "live" }) {
  return (
    <span
      aria-live="polite"
      className="flex h-[30px] items-center gap-1.5 rounded-[10px] bg-(--aw-teal-soft) p-2 text-[14px] leading-none font-medium tracking-[-0.28px] text-(--aw-teal)"
    >
      {status === "live" ? <span aria-hidden className="ml-0.5 size-1.5 rounded-full bg-(--aw-teal)" /> : null}
      <span className="px-0.5">{status === "live" ? "Live" : "Draft"}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ share */

function ShareButton({
  name,
  anyone,
  onAnyoneChange,
}: {
  name: string
  anyone: boolean
  onAnyoneChange: (v: boolean) => void
}) {
  const link = SHARE_LINK
  const copy = copyShareLink

  return (
    <Popover>
      <PopoverTrigger className="aw-btn flex h-[30px] items-center gap-1 p-2" data-raised="">
        <Asset src={ASSETS.share} w={14} h={14} />
        <span className="text-[14px] leading-none font-medium tracking-[-0.28px] text-(--aw-muted)">Share</span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 gap-3 p-4">
        <div className="flex flex-col gap-1">
          <PopoverTitle className="text-[14px] text-(--aw-ink)">Share “{name}”</PopoverTitle>
          <PopoverDescription className="text-[13px] leading-snug text-(--aw-muted)">
            Teammates with access can view runs and edit the draft.
          </PopoverDescription>
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            aria-label="Share link"
            onFocus={(e) => e.currentTarget.select()}
            className="aw-input h-[30px] min-w-0 flex-1 px-2.5 text-[13px] text-(--aw-muted)"
          />
          <button type="button" onClick={copy} className="aw-btn-dark h-[30px] px-2.5 text-[13px] font-medium">
            Copy link
          </button>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] bg-(--aw-canvas) p-2.5 text-[13px] text-(--aw-ink-2)">
          Anyone in the workspace can view
          <Switch
            checked={anyone}
            onCheckedChange={onAnyoneChange}
            className="data-checked:bg-(--aw-teal)"
          />
        </label>
      </PopoverContent>
    </Popover>
  )
}

/* ---------------------------------------------------------------- publish */

function PublishButton({
  name,
  status,
  blockCount,
  onPublish,
}: {
  name: string
  status: "draft" | "live"
  blockCount: number
  onPublish: () => void
}) {
  const [open, setOpen] = useState(false)
  const upToDate = status === "live"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="aw-btn-dark flex h-[30px] items-center justify-center gap-1.5 px-2.5 py-2">
        {/* top glow — Figma Ellipse 41743 (148×14, blurred), clipped by the button */}
        <Asset
          src={ASSETS.publishGlow}
          w={196}
          h={62}
          className="pointer-events-none absolute top-[-36px] left-[calc(50%+0.5px)] -z-10 -translate-x-1/2"
        />
        <Asset src={ASSETS.play} w={14} h={14} />
        <span className="px-0.5 text-[14px] leading-none font-medium tracking-[-0.28px] text-white">Published</span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 gap-3 p-4">
        <div className="flex flex-col gap-1">
          <PopoverTitle className="text-[14px] text-(--aw-ink)">
            {upToDate ? "Everything is live" : "Publish changes?"}
          </PopoverTitle>
          <PopoverDescription className="text-[13px] leading-snug text-(--aw-muted)">
            {upToDate
              ? `“${name}” is running with the latest ${blockCount} blocks.`
              : `“${name}” will run its ${blockCount} blocks every time the trigger fires.`}
          </PopoverDescription>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="aw-btn h-[30px] px-2.5 text-[13px] font-medium text-(--aw-muted)"
          >
            {upToDate ? "Close" : "Cancel"}
          </button>
          {!upToDate ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onPublish()
              }}
              className="aw-btn-dark h-[30px] px-2.5 text-[13px] font-medium"
            >
              Publish
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
