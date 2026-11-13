"use client"

import { useRef, type ReactElement, type ReactNode } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type SheetProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** optional element that opens the sheet */
  trigger?: ReactElement
  title: ReactNode
  /** visually hide the title (it's still announced) */
  hideTitle?: boolean
  /** extra controls on the right of the title row */
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/** Pixels the sheet must be dragged down before it closes on release. */
const CLOSE_DISTANCE = 96

/**
 * Bottom sheet for phones and tablets (Base UI Dialog): slides up on the
 * drawer curve, closes with the × button, Escape, a tap on the scrim or a
 * downward swipe on the grab handle / title row.
 */
export function Sheet({ open, onOpenChange, trigger, title, hideTitle, actions, children, className }: SheetProps) {
  const popup = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; y: number; dy: number; t: number } | null>(null)

  const setOffset = (dy: number, animate: boolean) => {
    const el = popup.current
    if (!el) return
    el.style.transition = animate ? "" : "none"
    el.style.transform = dy ? `translateY(${dy}px)` : ""
  }

  const swipe = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as Element).closest("button, a, input")) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { id: e.pointerId, y: e.clientY, dy: 0, t: performance.now() }
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      // resist upward drags, follow downward ones 1:1
      d.dy = Math.max(-12, e.clientY - d.y)
      setOffset(d.dy < 0 ? d.dy / 3 : d.dy, false)
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      drag.current = null
      const velocity = d.dy / Math.max(1, performance.now() - d.t)
      setOffset(0, true)
      if (d.dy > CLOSE_DISTANCE || (d.dy > 24 && velocity > 0.6)) onOpenChange?.(false)
    },
    onPointerCancel: () => {
      drag.current = null
      setOffset(0, true)
    },
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange?.(next)}>
      {trigger ? <Dialog.Trigger render={trigger} /> : null}
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-(--bg-overlay) transition-opacity duration-300 ease-drawer",
            "data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none"
          )}
        />
        <Dialog.Popup
          ref={popup}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[18px] bg-white outline-none",
            "shadow-[0_-1px_0_var(--aw-line),0_-16px_48px_-12px_rgba(9,9,11,0.18)]",
            "pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-drawer",
            "data-starting-style:translate-y-full data-ending-style:translate-y-full motion-reduce:transition-none",
            className
          )}
        >
          <div {...swipe} className="flex shrink-0 cursor-grab touch-none flex-col active:cursor-grabbing">
            <span aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-[#dcdcdc]" />
            <div className="flex min-h-14 items-center gap-2 px-4 py-2">
              <Dialog.Title
                className={cn(
                  "min-w-0 flex-1 truncate aw-clip-safe text-[16px] leading-none font-medium tracking-[-0.32px] text-(--aw-ink)",
                  hideTitle && "sr-only"
                )}
              >
                {title}
              </Dialog.Title>
              {hideTitle ? <span className="flex-1" /> : null}
              {actions}
              <Dialog.Close aria-label="Close" className="aw-btn flex size-10 shrink-0 items-center justify-center">
                <XIcon className="size-4 text-(--aw-muted)" strokeWidth={1.75} />
              </Dialog.Close>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
