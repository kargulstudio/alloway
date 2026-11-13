"use client"

import { useCallback, useRef, useState } from "react"

type Entry<T> = { value: T; label: string }
type State<T> = { past: Entry<T>[]; present: Entry<T>; future: Entry<T>[]; key: string | null; at: number }

const LIMIT = 100
/** Edits with the same coalesce key this close together merge into one undo step (typing). */
const COALESCE_MS = 1200

/**
 * Undo/redo for a single immutable value. Each entry remembers the label of
 * the change that produced it, so undo/redo can say what they did.
 * A ref mirrors the state so event handlers always see the latest value.
 */
export function useHistory<T>(initial: T) {
  const [state, setState] = useState<State<T>>(() => ({
    past: [],
    present: { value: initial, label: "" },
    future: [],
    key: null,
    at: 0,
  }))
  const ref = useRef(state)

  const apply = useCallback((next: State<T>) => {
    ref.current = next
    setState(next)
  }, [])

  const current = useCallback(() => ref.current.present.value, [])

  /** Record a change. Same `coalesce` key within ~1s replaces the last step instead. */
  const commit = useCallback(
    (next: T | ((prev: T) => T), label: string, coalesce?: string) => {
      const h = ref.current
      const value = typeof next === "function" ? (next as (prev: T) => T)(h.present.value) : next
      if (Object.is(value, h.present.value)) return
      const now = Date.now()
      if (coalesce && h.key === coalesce && now - h.at < COALESCE_MS) {
        apply({ ...h, present: { value, label }, future: [], at: now })
        return
      }
      apply({
        past: [...h.past, h.present].slice(-LIMIT),
        present: { value, label },
        future: [],
        key: coalesce ?? null,
        at: now,
      })
    },
    [apply]
  )

  /** Step back. Returns the label of the undone change, or null when there's nothing to undo. */
  const undo = useCallback(() => {
    const h = ref.current
    const prev = h.past.at(-1)
    if (!prev) return null
    apply({ past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], key: null, at: 0 })
    return h.present.label
  }, [apply])

  /** Step forward. Returns the label of the redone change, or null. */
  const redo = useCallback(() => {
    const h = ref.current
    const [next, ...rest] = h.future
    if (!next) return null
    apply({ past: [...h.past, h.present], present: next, future: rest, key: null, at: 0 })
    return next.label
  }, [apply])

  /**
   * Toast "Undo" for one specific change: a plain undo while that change is
   * still the latest, otherwise put `before` back as a new (redoable) step.
   */
  const revert = useCallback(
    (after: T, before: T, label: string) => {
      if (Object.is(ref.current.present.value, after)) undo()
      else commit(before, `Undo ${label}`)
    },
    [undo, commit]
  )

  return {
    value: state.present.value,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    current,
    commit,
    undo,
    redo,
    revert,
  }
}
