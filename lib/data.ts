/**
 * Mock data for the Alloway workflow editor prototype.
 * Source: Figma "Site Map" frame (node 1:516). Every icon path points at an
 * exact asset exported from that frame into /public/figma.
 */

const A = "/figma"

export const ASSETS = {
  logo: `${A}/logo.svg`,
  collapse: `${A}/align-left-01.svg`,
  fileTeal12: `${A}/file-05-white-12.svg`,
  fileTeal14: `${A}/file-05-white-14.svg`,
  fileTeal8: `${A}/file-05-white-8.svg`,
  chevronDown: `${A}/chevron-down.svg`,
  chevronLeft: `${A}/chevron-left.svg`,
  divider: `${A}/divider.svg`,
  share: `${A}/share-07.svg`,
  play: `${A}/play.svg`,
  publishGlow: `${A}/publish-glow.svg`,
  refreshHeader: `${A}/refresh-ccw-05.svg`,
  refresh: `${A}/refresh-cw-01.svg`,
  trash: `${A}/trash-03.svg`,
  spinner: `${A}/spinner.svg`,
  treeBranch: `${A}/tree-branch.svg`,
  minus: `${A}/minus.svg`,
  plus: `${A}/plus.svg`,
  hand: `${A}/hand.svg`,
  doc: `${A}/file-05.svg`,
  rows: `${A}/rows-01.svg`,
  stars: `${A}/stars-01.svg`,
  connector: `${A}/connector.svg`,
  branchLeft: `${A}/branch-left.svg`,
  branchRight: `${A}/branch-right.svg`,
  branchHandle: `${A}/branch-handle.svg`,
  dot: `${A}/dot.svg`,
} as const

/* ------------------------------------------------------------------ sidebar */

export type NavItem = { id: string; label: string; icon: string }
export type TeamItem = { id: string; label: string; glyph: string }

export const PRIMARY_NAV: NavItem[] = [
  { id: "notifications", label: "Notifications", icon: `${A}/bell-01.svg` },
  { id: "tasks", label: "Tasks", icon: `${A}/check-circle.svg` },
  { id: "notes", label: "Notes", icon: `${A}/sticker-circle.svg` },
  { id: "email", label: "Email", icon: `${A}/mail-02.svg` },
  { id: "reports", label: "Reports", icon: `${A}/bar-chart-10.svg` },
  { id: "automations", label: "Automations", icon: `${A}/dataflow-02.svg` },
]

export const FAVORITE_DOCS: NavItem[] = [
  { id: "doc-meeting", label: "Meeting Summary 15/08", icon: `${A}/file-05.svg` },
  { id: "doc-undraw", label: "Undraw Project", icon: `${A}/file-05.svg` },
  { id: "doc-b2b", label: "B2B Relationship Doc", icon: `${A}/file-05.svg` },
]

export const TEAMS: TeamItem[] = [
  { id: "team-companies", label: "Companies", glyph: `${A}/building-06.svg` },
  { id: "team-people", label: "People", glyph: `${A}/users-02.svg` },
]

export const FOOTER_NAV: NavItem[] = [
  { id: "invite", label: "Invite teammates", icon: `${A}/arrow-narrow-left.svg` },
  { id: "help", label: "Help and first steps", icon: `${A}/user-plus-01.svg` },
]

export const RECENT_WORKFLOWS = ["Lead routing", "Churn risk alerts", "Weekly pipeline digest"]

/* ------------------------------------------------------------------- blocks */

export type BlockTone = "teal" | "orange" | "violet"
export type BlockKind = "trigger" | "filter" | "action" | "condition" | "query" | "utility"

export type Block = {
  id: string
  /** catalog entry this block was made from (see BLOCK_TYPES / TRIGGER_TYPES) */
  type: string
  kind: BlockKind
  title: string
  /** chip on the canvas card */
  chip: string
  /** app tag in the inspector header */
  app: string
  tone: BlockTone
  /** 10px glyph used on the canvas card */
  icon: string
  /** glyph used in the inspector (14px) and next-step row (8.4px) */
  inspectorIcon: { lg: string; sm: string }
  description: string
  /** linear successor */
  next: string | null
  /** if/else successors */
  branches?: { true: string | null; false: string | null }
  inputs: { label: string; value: string }[]
}

export const TONE_COLOR: Record<BlockTone, string> = {
  teal: "#14b398",
  orange: "#ffa001",
  violet: "#8f68f4",
}

const icon = (name: string) => `${A}/${name}.svg`
const scaled = (name: string) => ({ lg: icon(name), sm: icon(name) })

/** Everything about a block that comes from its type (the rest is per-block). */
export type BlockTemplate = Pick<Block, "type" | "kind" | "title" | "chip" | "app" | "tone" | "icon" | "inspectorIcon" | "inputs"> & {
  category: string
  /** one-line hint in the block picker */
  hint: string
  /** if/else: successors are two branches instead of `next` */
  branching?: boolean
}

/** Insertable steps, grouped by category in the block picker. */
export const BLOCK_TYPES: BlockTemplate[] = [
  {
    type: "filter",
    category: "Conditions",
    kind: "filter",
    title: "Filter",
    hint: "Continue only when a condition matches",
    chip: "Conditions",
    app: "Logic",
    tone: "orange",
    icon: icon("filter-funnel-02"),
    inspectorIcon: scaled("filter-funnel-02"),
    inputs: [
      { label: "Field", value: "Company › Country" },
      { label: "Operator", value: "is not" },
      { label: "Value", value: "United States" },
    ],
  },
  {
    type: "if-else",
    category: "Conditions",
    kind: "condition",
    title: "If/else",
    hint: "Split into a true and a false branch",
    chip: "Conditions",
    app: "Logic",
    tone: "orange",
    icon: icon("database-03"),
    inspectorIcon: scaled("database-03"),
    branching: true,
    inputs: [
      { label: "Condition", value: "Task › Status" },
      { label: "Operator", value: "equals" },
      { label: "Value", value: "Completed" },
    ],
  },
  {
    type: "create-task",
    category: "Tasks",
    kind: "action",
    title: "Create task",
    hint: "Assign a task to a teammate",
    chip: "Tasks",
    app: "Tasks",
    tone: "violet",
    icon: icon("file-plus-01"),
    inspectorIcon: scaled("file-plus-01"),
    inputs: [
      { label: "Assignee", value: "Record owner" },
      { label: "Due", value: "In 2 business days" },
      { label: "Linked record", value: "Trigger › Company" },
    ],
  },
  {
    type: "send-email",
    category: "Tasks",
    kind: "action",
    title: "Send email",
    hint: "Email a person on the record",
    chip: "Tasks",
    app: "Email",
    tone: "violet",
    icon: icon("mail-02-white"),
    inspectorIcon: scaled("mail-02-white"),
    inputs: [
      { label: "To", value: "Record owner" },
      { label: "Template", value: "Follow-up" },
      { label: "Send as", value: "Workspace" },
    ],
  },
  {
    type: "find-records",
    category: "Records",
    kind: "query",
    title: "Find records",
    hint: "Look up records that match",
    chip: "Records",
    app: "Records",
    tone: "teal",
    icon: icon("file-search-01"),
    inspectorIcon: scaled("file-search-01"),
    inputs: [
      { label: "Object", value: "People" },
      { label: "Match", value: "Company = Trigger › Company" },
      { label: "Limit", value: "25 records" },
    ],
  },
  {
    type: "find-list-entries",
    category: "Records",
    kind: "query",
    title: "Find list entries",
    hint: "Look up entries in a list",
    chip: "Records",
    app: "Lists",
    tone: "teal",
    icon: icon("file-search-01"),
    inspectorIcon: { lg: ASSETS.fileTeal14, sm: ASSETS.fileTeal8 },
    inputs: [
      { label: "List", value: "Enterprise pipeline" },
      { label: "Match", value: "Parent record = Company" },
      { label: "Limit", value: "50 entries" },
    ],
  },
  {
    type: "update-record",
    category: "Records",
    kind: "action",
    title: "Update record",
    hint: "Change attributes on a record",
    chip: "Records",
    app: "Records",
    tone: "teal",
    icon: icon("refresh-cw-01-white"),
    inspectorIcon: scaled("refresh-cw-01-white"),
    inputs: [
      { label: "Record", value: "Trigger › Company" },
      { label: "Attribute", value: "Stage" },
      { label: "Value", value: "Qualified" },
    ],
  },
  {
    type: "create-record",
    category: "Records",
    kind: "action",
    title: "Create record",
    hint: "Add a new record to an object",
    chip: "Records",
    app: "Records",
    tone: "teal",
    icon: icon("plus-white"),
    inspectorIcon: scaled("plus-white"),
    inputs: [
      { label: "Object", value: "Deals" },
      { label: "Name", value: "Trigger › Company name" },
      { label: "Owner", value: "Record owner" },
    ],
  },
  {
    type: "delay",
    category: "Utilities",
    kind: "utility",
    title: "Delay",
    hint: "Wait before the next step",
    chip: "Utilities",
    app: "Logic",
    tone: "violet",
    icon: icon("clock-white"),
    inspectorIcon: scaled("clock-white"),
    inputs: [
      { label: "Wait", value: "1 day" },
      { label: "Resume at", value: "9:00 in record timezone" },
      { label: "Skip weekends", value: "Yes" },
    ],
  },
]

/** Events the trigger can listen to (the trigger itself can't be removed). */
export const TRIGGER_TYPES: BlockTemplate[] = [
  {
    type: "attribute-updated",
    category: "Triggers",
    kind: "trigger",
    title: "Attribute updated",
    hint: "When an attribute on a record changes",
    chip: "Data",
    app: "Records",
    tone: "teal",
    icon: icon("grid-01"),
    inspectorIcon: scaled("grid-01"),
    inputs: [
      { label: "Object", value: "Companies" },
      { label: "Attribute", value: "Record ID" },
      { label: "Fires on", value: "Any change" },
    ],
  },
  {
    type: "record-created",
    category: "Triggers",
    kind: "trigger",
    title: "Record created",
    hint: "When a new record is added",
    chip: "Data",
    app: "Records",
    tone: "teal",
    icon: icon("plus-white"),
    inspectorIcon: scaled("plus-white"),
    inputs: [
      { label: "Object", value: "Companies" },
      { label: "Created by", value: "Anyone" },
      { label: "Fires on", value: "Create" },
    ],
  },
  {
    type: "list-entry-added",
    category: "Triggers",
    kind: "trigger",
    title: "List entry added",
    hint: "When a record joins a list",
    chip: "Data",
    app: "Lists",
    tone: "teal",
    icon: icon("rows-01-white"),
    inspectorIcon: scaled("rows-01-white"),
    inputs: [
      { label: "List", value: "Enterprise pipeline" },
      { label: "Added by", value: "Anyone" },
      { label: "Fires on", value: "Add" },
    ],
  },
  {
    type: "task-completed",
    category: "Triggers",
    kind: "trigger",
    title: "Task completed",
    hint: "When a linked task is marked done",
    chip: "Tasks",
    app: "Tasks",
    tone: "violet",
    icon: icon("check-circle-white"),
    inspectorIcon: scaled("check-circle-white"),
    inputs: [
      { label: "Task list", value: "All tasks" },
      { label: "Linked to", value: "Companies" },
      { label: "Fires on", value: "Completion" },
    ],
  },
]

export function templateFor(type: string): BlockTemplate | undefined {
  return BLOCK_TYPES.find((t) => t.type === type) ?? TRIGGER_TYPES.find((t) => t.type === type)
}

/** Category → templates, in catalog order (block picker + type menus). */
export function groupByCategory(templates: BlockTemplate[]) {
  const groups: { category: string; items: BlockTemplate[] }[] = []
  for (const t of templates) {
    const group = groups.find((g) => g.category === t.category)
    if (group) group.items.push(t)
    else groups.push({ category: t.category, items: [t] })
  }
  return groups
}

/** A new block of `type` with the catalog defaults. */
export function blockFromTemplate(t: BlockTemplate, id: string): Block {
  return {
    id,
    type: t.type,
    kind: t.kind,
    title: t.title,
    chip: t.chip,
    app: t.app,
    tone: t.tone,
    icon: t.icon,
    inspectorIcon: t.inspectorIcon,
    description: "",
    next: null,
    branches: t.branching ? { true: null, false: null } : undefined,
    inputs: t.inputs.map((i) => ({ ...i })),
  }
}

export const INITIAL_ROOT = "trigger"

const seed = (type: string, id: string, patch: Partial<Block>): Block => ({
  ...blockFromTemplate(templateFor(type)!, id),
  ...patch,
})

export const INITIAL_BLOCKS: Record<string, Block> = {
  trigger: seed("attribute-updated", "trigger", { description: "Record ID in Companies updated", next: "filter" }),
  filter: seed("filter", "filter", { next: "create-task" }),
  "create-task": seed("create-task", "create-task", { description: "Send an email to non-US company", next: "if-else" }),
  "if-else": seed("if-else", "if-else", { branches: { true: "find-records", false: "find-list-entries" } }),
  "find-records": seed("find-records", "find-records", {}),
  "find-list-entries": seed("find-list-entries", "find-list-entries", {}),
}

/** The Figma frame shows the inspector open on this block. */
export const INITIAL_SELECTED = "find-list-entries"

/* --------------------------------------------------------------------- runs */

export type Run = {
  id: string
  status: "succeeded" | "failed" | "running"
  record: string
  started: string
  duration: string
  steps: number
}

export const RUNS: Run[] = [
  { id: "run_8f21", status: "running", record: "Northwind Traders", started: "Just now", duration: "—", steps: 3 },
  { id: "run_8f1c", status: "succeeded", record: "Globex GmbH", started: "4 min ago", duration: "1.8s", steps: 5 },
  { id: "run_8f0a", status: "succeeded", record: "Initech Ltd.", started: "22 min ago", duration: "2.1s", steps: 5 },
  { id: "run_8ef3", status: "failed", record: "Umbrella KK", started: "1 h ago", duration: "0.9s", steps: 3 },
  { id: "run_8ee9", status: "succeeded", record: "Stark Industries", started: "3 h ago", duration: "1.6s", steps: 5 },
  { id: "run_8ed2", status: "succeeded", record: "Wayne Enterprises", started: "Yesterday", duration: "2.4s", steps: 5 },
  { id: "run_8ec0", status: "succeeded", record: "Soylent SA", started: "Yesterday", duration: "1.9s", steps: 4 },
]
