"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ASSETS, FAVORITE_DOCS, FOOTER_NAV, PRIMARY_NAV, TEAMS } from "@/lib/data"
import { comingSoon } from "@/lib/prototype"
import { Asset, Tile } from "./asset"

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
}

/** Figma 1:517 — 240px rail, white, right hairline #EDEDED. Collapses to a 62px icon rail. */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      aria-label="Sidebar"
      data-collapsed={collapsed || undefined}
      className={cn(
        "group/aw-sidebar relative z-10 flex h-full shrink-0 flex-col overflow-hidden bg-white",
        "shadow-[inset_-1px_0_0_var(--aw-line)]",
        "w-(--aw-sidebar) data-collapsed:w-(--aw-sidebar-collapsed)",
        "transition-[width] duration-(--duration-slow) ease-(--ease-out) motion-reduce:transition-none"
      )}
    >
      {/* Brand — 1:518 */}
      <div className="flex h-(--aw-header) shrink-0 items-center p-4 shadow-[inset_0_-1px_0_var(--aw-line)]">
        <div className="relative flex w-full items-center gap-2">
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 transition-opacity duration-(--duration-fast) ease-(--ease-out)",
              "group-data-collapsed/aw-sidebar:pointer-events-none group-data-collapsed/aw-sidebar:opacity-0"
            )}
          >
            <Asset src={ASSETS.logo} w={30} h={30} alt="Alloway" />
            <span className="font-(family-name:--aw-font-brand) text-[16px] leading-none font-[590] tracking-[-0.48px] whitespace-nowrap text-(--aw-ink)">
              Alloway
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className={cn(
                "aw-btn absolute right-0 flex size-[30px] items-center justify-center",
                "transition-[right,background-color,box-shadow] duration-(--duration-slow) ease-(--ease-out)",
                "group-data-collapsed/aw-sidebar:right-0"
              )}
            >
              <Asset
                src={ASSETS.collapse}
                w={14}
                h={14}
                className="transition-transform duration-(--duration-slow) ease-(--ease-out) group-data-collapsed/aw-sidebar:rotate-180"
              />
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? "Expand" : "Collapse"} sidebar · ⌘\</TooltipContent>
          </Tooltip>
          {/* keeps the row height when the wordmark is hidden */}
          <span className="h-[30px] w-0" aria-hidden />
        </div>
      </div>

      {/* Navigation — 1:534 */}
      <nav aria-label="Workspace" className="flex min-h-0 flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto p-4">
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

        <Group label="Favorite" collapsed={collapsed}>
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

        <Group label="Your teams" collapsed={collapsed}>
          {TEAMS.map((item) => (
            <NavRow
              key={item.id}
              label={item.label}
              collapsed={collapsed}
              onClick={() => comingSoon(item.label)}
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

function Group({ label, collapsed, children }: { label?: string; collapsed?: boolean; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-1">
      {label ? (
        <div className="relative flex h-5 items-center overflow-hidden rounded-lg px-2 py-1">
          <span
            className={cn(
              "font-(family-name:--aw-font-mono) text-[12px] leading-none font-medium tracking-[-0.36px] whitespace-nowrap text-(--aw-label)",
              "transition-opacity duration-(--duration-fast) ease-(--ease-out)",
              collapsed && "opacity-0"
            )}
          >
            {label}
          </span>
          {/* collapsed: the mono label becomes a short rule */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-x-2 top-1/2 h-px bg-(--aw-line) opacity-0 transition-opacity duration-(--duration-fast)",
              collapsed && "opacity-100"
            )}
          />
        </div>
      ) : null}
      {children}
    </div>
  )
}

function NavRow({
  label,
  icon,
  active,
  collapsed,
  gap = 6,
  onClick,
}: {
  label: string
  icon: ReactNode
  active?: boolean
  collapsed: boolean
  gap?: number
  onClick: () => void
}) {
  const row = (
    <button
      type="button"
      onClick={onClick}
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className="aw-ghost flex h-[30px] w-full items-center overflow-hidden p-2 text-left text-(--aw-muted)"
      style={{ gap }}
    >
      {icon}
      <span
        className={cn(
          "min-w-0 flex-1 truncate aw-clip-safe px-0.5 text-[14px] leading-none font-medium tracking-[-0.14px]",
          "transition-opacity duration-(--duration-fast) ease-(--ease-out)",
          collapsed && "opacity-0"
        )}
      >
        {label}
      </span>
    </button>
  )

  if (!collapsed) return row
  return (
    <Tooltip>
      <TooltipTrigger render={row} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
