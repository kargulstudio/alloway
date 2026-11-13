"use client"

import type { ReactElement, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ASSETS, FAVORITE_DOCS, FOOTER_NAV, PRIMARY_NAV, TEAMS } from "@/lib/data"
import { comingSoon } from "@/lib/prototype"
import { Asset, Tile } from "./asset"

type SidebarProps = {
  collapsed: boolean
  /** true when the last toggle came from the keyboard → skip the animation */
  instant: boolean
  onToggle: () => void
}

/**
 * Every collapse animation shares one duration + curve with the rail width,
 * is skipped for keyboard toggles (`data-instant`) and for reduced motion.
 */
const SLOW = "duration-(--duration-slow) ease-out-strong group-data-instant/aw-sidebar:transition-none motion-reduce:transition-none"
const FADE = "transition-opacity duration-(--duration-fast) ease-out-strong group-data-instant/aw-sidebar:transition-none motion-reduce:transition-none"

/** Figma 1:517 — 240px rail, white, right hairline #EDEDED. Collapses to a 62px icon rail. */
export function Sidebar({ collapsed, instant, onToggle }: SidebarProps) {
  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed || undefined}
      data-instant={instant || undefined}
      className={cn(
        "group/aw-sidebar relative z-10 flex h-full shrink-0 flex-col overflow-hidden bg-white",
        "shadow-[inset_-1px_0_0_var(--aw-line)]",
        "w-(--aw-sidebar) data-collapsed:w-(--aw-sidebar-collapsed)",
        "transition-[width]",
        SLOW
      )}
    >
      {/* Brand — 1:518. The logo always stays (centred on the 62px rail axis); only the wordmark fades. */}
      <div className="flex h-(--aw-header) shrink-0 items-center p-4 shadow-[inset_0_-1px_0_var(--aw-line)]">
        <div className="flex w-full items-center gap-2">
          <Asset src={ASSETS.logo} w={30} h={30} alt="Alloway" />
          <span
            aria-hidden={collapsed || undefined}
            className={cn(
              "min-w-0 flex-1 truncate aw-clip-safe font-(family-name:--aw-font-brand) text-[16px] leading-none font-[590] tracking-[-0.48px] whitespace-nowrap text-(--aw-ink)",
              FADE,
              "group-data-collapsed/aw-sidebar:opacity-0"
            )}
          >
            Alloway
          </span>
          {/* reserves the toggle's slot in the expanded row */}
          <span aria-hidden className="h-[30px] w-[30px] shrink-0" />
        </div>
      </div>

      {/*
        Sidebar toggle. One element that glides between two slots:
          expanded  → right end of the brand row  (x 194, y 16)
          collapsed → under the logo, top of nav  (x 16,  y 78)
        Only `transform` animates, in step with the rail's width.
      */}
      <div
        className={cn(
          "absolute top-0 left-0 z-20 translate-x-[194px] translate-y-4",
          "group-data-collapsed/aw-sidebar:translate-x-4 group-data-collapsed/aw-sidebar:translate-y-[78px]",
          "transition-transform",
          SLOW
        )}
      >
        <Tooltip>
          <TooltipTrigger
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="aw-btn flex size-[30px] items-center justify-center"
          >
            <Asset
              src={ASSETS.collapse}
              w={14}
              h={14}
              className={cn("transition-transform", SLOW, collapsed && "-scale-x-100")}
            />
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {collapsed ? "Expand" : "Collapse"} sidebar · ⌘\
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Navigation — 1:534 */}
      <nav aria-label="Workspace" className="flex min-h-0 flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto p-4">
        <div className="flex flex-col">
          {/* opens a 30px + 8px slot for the toggle when the rail is collapsed */}
          <div
            aria-hidden
            className={cn("grid grid-rows-[0fr] transition-[grid-template-rows]", SLOW, "group-data-collapsed/aw-sidebar:grid-rows-[1fr]")}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="h-[38px]" />
            </div>
          </div>
          <Group>
            {PRIMARY_NAV.map((item) => (
              <NavRow
                key={item.id}
                label={item.label}
                collapsed={collapsed}
                onClick={() => comingSoon(item.label)}
                icon={<Asset src={item.icon} w={14} h={14} />}
              />
            ))}
          </Group>
        </div>

        <Group label="Favorite">
          {FAVORITE_DOCS.map((item) => (
            <NavRow
              key={item.id}
              label={item.label}
              collapsed={collapsed}
              onClick={() => comingSoon(item.label)}
              icon={<Asset src={item.icon} w={14} h={14} />}
            />
          ))}
        </Group>

        <Group label="Your teams">
          {TEAMS.map((item) => (
            <NavRow
              key={item.id}
              label={item.label}
              collapsed={collapsed}
              onClick={() => comingSoon(`${item.label} team`)}
              icon={<Tile tone="#14b398" size={14} radius={4} glyph={item.glyph} glyphSize={8} variant="xs" />}
            />
          ))}
        </Group>
      </nav>

      {/* Footer — 1:599 */}
      <div className="flex shrink-0 flex-col p-4">
        {FOOTER_NAV.map((item) => (
          <NavRow
            key={item.id}
            label={item.label}
            collapsed={collapsed}
            gap={8}
            onClick={() => comingSoon(item.label)}
            icon={<Asset src={item.icon} w={14} h={14} />}
          />
        ))}
      </div>
    </aside>
  )
}

/** A nav group; its mono heading fades and folds away (grid rows) on the collapsed rail. */
function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col">
      {label ? (
        <div
          className={cn(
            "grid grid-rows-[1fr] transition-[grid-template-rows,opacity]",
            SLOW,
            "group-data-collapsed/aw-sidebar:grid-rows-[0fr] group-data-collapsed/aw-sidebar:opacity-0"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <h3 className="flex h-5 items-center px-2 py-1 font-(family-name:--aw-font-mono) text-[12px] leading-none font-medium tracking-[-0.36px] whitespace-nowrap text-(--aw-label)">
              {label}
            </h3>
            <div className="h-1" />
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

function NavRow({
  label,
  icon,
  collapsed,
  gap = 6,
  onClick,
}: {
  label: string
  icon: ReactNode
  collapsed: boolean
  gap?: number
  onClick: () => void
}) {
  const row = (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      className="aw-ghost flex h-[30px] w-full items-center overflow-hidden p-2 text-left text-(--aw-muted)"
      style={{ gap }}
    >
      {icon}
      <span
        className={cn(
          "min-w-0 flex-1 truncate aw-clip-safe px-0.5 text-[14px] leading-none font-medium tracking-[-0.14px] whitespace-nowrap",
          FADE,
          "group-data-collapsed/aw-sidebar:opacity-0"
        )}
      >
        {label}
      </span>
    </button>
  )

  return (
    <SidebarTooltip label={label} enabled={collapsed}>
      {row}
    </SidebarTooltip>
  )
}

function SidebarTooltip({ label, enabled, children }: { label: string; enabled: boolean; children: ReactElement }) {
  if (!enabled) return children
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
