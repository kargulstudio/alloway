"use client"

import type { ReactElement } from "react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BLOCK_TYPES, groupByCategory, TONE_COLOR, type BlockTemplate } from "@/lib/data"
import { Tile } from "./asset"

const GROUPS = groupByCategory(BLOCK_TYPES)

type BlockPickerProps = {
  /** the element that opens the picker (rendered as the menu trigger) */
  trigger: ReactElement
  onPick: (template: BlockTemplate) => void
  /** where the menu opens relative to the trigger */
  side?: "bottom" | "right" | "left" | "top"
  align?: "start" | "center" | "end"
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** catalog to choose from — defaults to every insertable block */
  templates?: BlockTemplate[]
  /** highlights the current type (type menus) */
  current?: string
  label?: string
}

/** Grouped block catalog (Conditions · Tasks · Records · Utilities) in a menu. */
export function BlockPicker({
  trigger,
  onPick,
  side = "bottom",
  align = "center",
  open,
  onOpenChange,
  templates,
  current,
  label = "Add a step",
}: BlockPickerProps) {
  const groups = templates ? groupByCategory(templates) : GROUPS
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent side={side} align={align} sideOffset={8} className="w-[272px] p-1.5">
        <p className="px-2 pt-1.5 pb-1 text-[13px] leading-none font-medium tracking-[-0.2px] text-(--aw-ink)">{label}</p>
        {groups.map((group, i) => (
          <div key={group.category}>
            {i > 0 ? <DropdownMenuSeparator className="mx-0.5 bg-(--aw-line)" /> : null}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 pt-1.5 pb-1 font-(family-name:--aw-font-mono) text-[12px] leading-none font-medium tracking-[-0.36px] text-(--aw-label)">
                {group.category}
              </DropdownMenuLabel>
              {group.items.map((t) => (
                <PickerItem key={t.type} template={t} current={current === t.type} onPick={() => onPick(t)} />
              ))}
            </DropdownMenuGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PickerItem({ template, current, onPick }: { template: BlockTemplate; current: boolean; onPick: () => void }) {
  return (
    <DropdownMenuItem
      onClick={onPick}
      data-current={current || undefined}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-[8px] px-2 py-1.5",
        "focus:bg-(--aw-chip) data-current:bg-(--aw-chip)"
      )}
    >
      <Tile tone={TONE_COLOR[template.tone]} size={20} radius={6} glyph={template.icon} glyphSize={10} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate aw-clip-safe text-[13px] leading-none font-medium tracking-[-0.2px] text-(--aw-ink-2)">
          {template.title}
        </span>
        <span className="truncate aw-clip-safe text-[12px] leading-none font-medium tracking-[-0.2px] text-(--aw-faint)">
          {template.hint}
        </span>
      </span>
      {current ? <span className="text-[12px] leading-none font-medium text-(--aw-teal)">Current</span> : null}
    </DropdownMenuItem>
  )
}
