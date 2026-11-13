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
  pointerActive: `${A}/pointer-active.svg`,
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

export type Block = {
  id: string
  kind: "trigger" | "filter" | "action" | "condition" | "query"
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

export const INITIAL_ROOT = "trigger"

export const INITIAL_BLOCKS: Record<string, Block> = {
  trigger: {
    id: "trigger",
    kind: "trigger",
    title: "Attribute updated",
    chip: "Data",
    app: "Records",
    tone: "teal",
    icon: icon("grid-01"),
    inspectorIcon: scaled("grid-01"),
    description: "Record ID in Companies updated",
    next: "filter",
    inputs: [
      { label: "Object", value: "Companies" },
      { label: "Attribute", value: "Record ID" },
      { label: "Fires on", value: "Any change" },
    ],
  },
  filter: {
    id: "filter",
    kind: "filter",
    title: "Filter",
    chip: "Conditions",
    app: "Logic",
    tone: "orange",
    icon: icon("filter-funnel-02"),
    inspectorIcon: scaled("filter-funnel-02"),
    description: "",
    next: "create-task",
    inputs: [
      { label: "Field", value: "Company › Country" },
      { label: "Operator", value: "is not" },
      { label: "Value", value: "United States" },
    ],
  },
  "create-task": {
    id: "create-task",
    kind: "action",
    title: "Create task",
    chip: "Tasks",
    app: "Tasks",
    tone: "violet",
    icon: icon("file-plus-01"),
    inspectorIcon: scaled("file-plus-01"),
    description: "Send an email to non-US company",
    next: "if-else",
    inputs: [
      { label: "Assignee", value: "Record owner" },
      { label: "Due", value: "In 2 business days" },
      { label: "Linked record", value: "Trigger › Company" },
    ],
  },
  "if-else": {
    id: "if-else",
    kind: "condition",
    title: "If/else",
    chip: "Conditions",
    app: "Logic",
    tone: "orange",
    icon: icon("database-03"),
    inspectorIcon: scaled("database-03"),
    description: "",
    next: null,
    branches: { true: "find-records", false: "find-list-entries" },
    inputs: [
      { label: "Condition", value: "Task › Status" },
      { label: "Operator", value: "equals" },
      { label: "Value", value: "Completed" },
    ],
  },
  "find-records": {
    id: "find-records",
    kind: "query",
    title: "Find records",
    chip: "Records",
    app: "Records",
    tone: "teal",
    icon: icon("file-search-01"),
    inspectorIcon: scaled("file-search-01"),
    description: "",
    next: null,
    inputs: [
      { label: "Object", value: "People" },
      { label: "Match", value: "Company = Trigger › Company" },
      { label: "Limit", value: "25 records" },
    ],
  },
  "find-list-entries": {
    id: "find-list-entries",
    kind: "query",
    title: "Find list entries",
    chip: "Records",
    app: "Lists",
    tone: "teal",
    icon: icon("file-search-01"),
    inspectorIcon: { lg: ASSETS.fileTeal14, sm: ASSETS.fileTeal8 },
    description: "",
    next: null,
    inputs: [
      { label: "List", value: "Enterprise pipeline" },
      { label: "Match", value: "Parent record = Company" },
      { label: "Limit", value: "50 entries" },
    ],
  },
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
