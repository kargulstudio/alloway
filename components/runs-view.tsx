"use client"

import { cn } from "@/lib/utils"
import { ASSETS, RUNS, type Run } from "@/lib/data"
import { Asset } from "./asset"

const TEXT = "text-[14px] leading-none font-medium tracking-[-0.28px]"

/** Runs tab — not in the Figma frame; built from the same tokens as the editor. */
export function RunsView({
  name,
  stepCount,
  onOpenEditor,
}: {
  name: string
  /** blocks on the longest path through the current workflow */
  stepCount: number
  onOpenEditor: () => void
}) {
  const ok = RUNS.filter((r) => r.status === "succeeded").length
  // a finished run walked the whole (longest) path; others stopped part-way
  const steps = (run: Run) => (run.status === "succeeded" ? stepCount : Math.min(run.steps, stepCount))
  return (
    <div className="aw-fade-in flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto bg-(--aw-canvas) p-4 md:p-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[16px] leading-none font-medium tracking-[-0.32px] text-(--aw-ink)">Runs</h1>
          <p className={cn(TEXT, "leading-[1.3] text-(--aw-faint)")}>
            {RUNS.length} runs of “{name}” in the last 24 hours · {ok} succeeded
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenEditor}
          className={cn("aw-btn h-10 shrink-0 px-2.5 whitespace-nowrap text-(--aw-muted) md:h-[30px]", TEXT)}
        >
          Back to editor
        </button>
      </div>

      {/* < md: one card per run */}
      <ul className="flex flex-col gap-2 md:hidden">
        {RUNS.map((run) => (
          <li key={run.id} className="flex flex-col gap-3 rounded-[12px] bg-white p-4 shadow-(--aw-shadow-card)">
            <div className="flex items-center justify-between gap-3">
              <StatusChip status={run.status} />
              <span className="font-(family-name:--aw-font-mono) text-[13px] leading-none text-(--aw-muted)">{run.id}</span>
            </div>
            <p className={cn(TEXT, "truncate aw-clip-safe text-(--aw-ink-2)")}>{run.record}</p>
            <dl className="grid grid-cols-3 gap-2 border-t border-(--aw-line-card) pt-3">
              {[
                ["Started", run.started],
                ["Steps", `${steps(run)} / ${stepCount}`],
                ["Duration", run.duration],
              ].map(([label, value]) => (
                <div key={label} className="flex min-w-0 flex-col gap-1.5">
                  <dt className="font-(family-name:--aw-font-mono) text-[12px] leading-none font-medium tracking-[-0.36px] text-(--aw-label)">
                    {label}
                  </dt>
                  <dd className={cn(TEXT, "truncate aw-clip-safe text-(--aw-muted) tabular-nums")}>{value}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-[12px] bg-white shadow-(--aw-shadow-card) md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-10 shadow-[inset_0_-1px_0_var(--aw-line-card)]">
              {["Status", "Run", "Triggered by", "Started", "Steps", "Duration"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-4 font-(family-name:--aw-font-mono) text-[12px] leading-none font-medium tracking-[-0.36px] text-(--aw-label)"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RUNS.map((run, i) => (
              <tr
                key={run.id}
                className={cn(
                  "h-12 transition-colors duration-(--duration-press) hover:bg-(--aw-canvas)",
                  i < RUNS.length - 1 && "shadow-[inset_0_-1px_0_var(--aw-line-card)]"
                )}
              >
                <td className="px-4">
                  <StatusChip status={run.status} />
                </td>
                <td className={cn("px-4 font-(family-name:--aw-font-mono) text-(--aw-muted)", "text-[13px] leading-none")}>
                  {run.id}
                </td>
                <td className={cn("px-4 text-(--aw-ink-2)", TEXT)}>{run.record}</td>
                <td className={cn("px-4 text-(--aw-muted)", TEXT)}>{run.started}</td>
                <td className={cn("px-4 text-(--aw-muted) tabular-nums", TEXT)}>{steps(run)} / {stepCount}</td>
                <td className={cn("px-4 text-(--aw-muted) tabular-nums", TEXT)}>{run.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusChip({ status }: { status: Run["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex h-[22px] items-center gap-1.5 rounded-[8px] bg-(--aw-chip) px-1.5">
        <Asset src={ASSETS.spinner} w={12} h={12} className="aw-spin" />
        <span className="text-[13px] leading-none font-medium text-(--aw-muted)">Running</span>
      </span>
    )
  }
  const ok = status === "succeeded"
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-[8px] px-1.5",
        ok ? "bg-(--aw-teal-soft) text-(--aw-teal)" : "bg-(--aw-danger-soft) text-(--aw-danger)"
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", ok ? "bg-(--aw-teal)" : "bg-(--aw-danger)")} />
      <span className="text-[13px] leading-none font-medium">{ok ? "Succeeded" : "Failed"}</span>
    </span>
  )
}
