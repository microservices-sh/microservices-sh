export type TaskStatus = "todo" | "in-progress" | "done";
export type TaskPriority = "High" | "Medium" | "Low";
export type Energy = "Deep" | "Review" | "Comms" | "Admin" | "Close";

export interface OperatorTask {
  id: string;
  title: string;
  detail: string;
  status: TaskStatus;
  category: string;
  priority: TaskPriority;
  due: string;
  source: "manual" | "agent" | "calendar" | "inbox";
  subtasks: { text: string; done: boolean }[];
}

export interface FocusBlock {
  id: string;
  time: string;
  title: string;
  energy: Energy;
  note: string;
  source: "manual" | "ai-draft" | "calendar";
}

export interface KnowledgeItem {
  id: string;
  title: string;
  source: string;
  status: "captured" | "learned" | "output";
  summary: string;
  tags: string[];
}

export interface ContentItem {
  id: string;
  title: string;
  platform: "Threads" | "LinkedIn" | "Blog" | "Carousel";
  status: "idea" | "draft" | "scheduled" | "published";
  angle: string;
  due: string;
}

export interface WorkerProfile {
  id: string;
  name: string;
  role: string;
  group: "operator" | "growth" | "academy" | "support";
  focus: string;
  skills: string[];
  lastOutput: string;
}

export const operatorTasks: OperatorTask[] = [
  {
    id: "task-focus-queue",
    title: "Refine today's focus queue",
    detail: "Pick top three outcomes, protect deep work, and park non-critical admin.",
    status: "in-progress",
    category: "Ops",
    priority: "High",
    due: "Today",
    source: "agent",
    subtasks: [
      { text: "Confirm must-ship task", done: true },
      { text: "Route research to AI team", done: true },
      { text: "Leave afternoon buffer", done: false }
    ]
  },
  {
    id: "task-content-brief",
    title: "Turn knowledge capture into content brief",
    detail: "Use the strongest learning point from the knowledge log as a publishable angle.",
    status: "todo",
    category: "Content",
    priority: "High",
    due: "Today",
    source: "inbox",
    subtasks: [
      { text: "Choose source item", done: false },
      { text: "Draft hook and takeaway", done: false }
    ]
  },
  {
    id: "task-client-follow-up",
    title: "Close client follow-up loop",
    detail: "Review open work packets and decide what needs a human reply.",
    status: "todo",
    category: "Comms",
    priority: "Medium",
    due: "Tomorrow",
    source: "manual",
    subtasks: [
      { text: "Check support inbox", done: false },
      { text: "Attach relevant file", done: false }
    ]
  },
  {
    id: "task-review-log",
    title: "Save daily review",
    detail: "Log shipped work, unresolved blockers, and tomorrow's first action.",
    status: "done",
    category: "Review",
    priority: "Medium",
    due: "Yesterday",
    source: "manual",
    subtasks: [
      { text: "Capture decisions", done: true },
      { text: "Write first action", done: true }
    ]
  }
];

export const focusBlocks: FocusBlock[] = [
  {
    id: "block-deep-work",
    time: "09:30-11:00",
    title: "Primary build block",
    energy: "Deep",
    note: "One outcome, no admin tabs.",
    source: "manual"
  },
  {
    id: "block-agent-triage",
    time: "11:20-12:00",
    title: "Agent output triage",
    energy: "Review",
    note: "Approve, redirect, or park generated work.",
    source: "ai-draft"
  },
  {
    id: "block-calendar-comms",
    time: "14:00-15:00",
    title: "Calendar and comms sweep",
    energy: "Comms",
    note: "Clear external dependencies without breaking the deep-work lane.",
    source: "calendar"
  },
  {
    id: "block-close-loop",
    time: "16:30-17:00",
    title: "Daily unlock review",
    energy: "Close",
    note: "Save the review before the work disappears.",
    source: "manual"
  }
];

export const calendarEvents = [
  { id: "cal-team", time: "10:00", title: "Team checkpoint", type: "calendar", action: "Convert to task" },
  { id: "cal-focus", time: "11:20", title: "Agent output triage", type: "focus", action: "Already planned" },
  { id: "cal-client", time: "15:30", title: "Client reply window", type: "calendar", action: "Pull into plan" }
];

export const knowledgeItems: KnowledgeItem[] = [
  {
    id: "know-workbench",
    title: "Clear Workbench principle",
    source: "Design note",
    status: "learned",
    summary: "The timeline is the anchor; secondary panels should disclose progressively.",
    tags: ["product", "ux"]
  },
  {
    id: "know-agent-roster",
    title: "Digital worker roster",
    source: "Vault import",
    status: "captured",
    summary: "Each worker needs a role, routing rule, skill set, and proof of finished work.",
    tags: ["agents", "routing"]
  },
  {
    id: "know-content-angle",
    title: "Founder post angle",
    source: "Knowledge URL",
    status: "output",
    summary: "A useful post starts with a decision, then explains the tradeoff.",
    tags: ["content", "ip"]
  }
];

export const contentItems: ContentItem[] = [
  {
    id: "content-clear-workbench",
    title: "Why the AI OS needs a workbench, not a hero page",
    platform: "Threads",
    status: "draft",
    angle: "Show the product decision behind dense dashboards.",
    due: "Today"
  },
  {
    id: "content-worker-roster",
    title: "Digital workers are useful only when they have jobs",
    platform: "LinkedIn",
    status: "idea",
    angle: "Agent names are not enough; routing and artifacts matter.",
    due: "This week"
  },
  {
    id: "content-calendar-sync",
    title: "From tasks to calendar blocks",
    platform: "Blog",
    status: "scheduled",
    angle: "Explain the loop from inbox capture to focus plan to review.",
    due: "Friday"
  }
];

export const aiWorkers: WorkerProfile[] = [
  {
    id: "demi",
    name: "Demi",
    role: "Operator COO",
    group: "operator",
    focus: "Route open work into must-do, can-wait, and agent-ready lanes.",
    skills: ["Daily handoff", "Meeting recap", "Calendar routing"],
    lastOutput: "Prepared today's focus queue and review prompts."
  },
  {
    id: "ip",
    name: "Jimmy IP",
    role: "Founder voice",
    group: "growth",
    focus: "Turn captured insight into publishable founder commentary.",
    skills: ["Hook writing", "Angle extraction", "Content memory"],
    lastOutput: "Drafted a workbench-vs-showcase post outline."
  },
  {
    id: "ada",
    name: "Ada",
    role: "Academy producer",
    group: "academy",
    focus: "Package course and workshop material into reusable delivery assets.",
    skills: ["Course page", "Syllabus", "Student comms"],
    lastOutput: "Mapped a content item into a lesson outline."
  },
  {
    id: "soso",
    name: "Soso",
    role: "Support operator",
    group: "support",
    focus: "Turn support signals into clear replies, SOPs, and follow-up work.",
    skills: ["Inbox triage", "SOP reply", "Customer signal"],
    lastOutput: "Tagged two support tickets for follow-up."
  }
];

export const reviewPrompts = [
  "What shipped today?",
  "What is still open?",
  "What should an agent prepare next?",
  "What is tomorrow's first action?"
];

export const reviewSignals = [
  { label: "Saved reviews", value: "4 / 5", tone: "good" as const },
  { label: "Open blockers", value: "2", tone: "warn" as const },
  { label: "Agent handoffs", value: "3", tone: "info" as const }
];

export const taskLanes = [
  { id: "todo", label: "To do", tasks: operatorTasks.filter((task) => task.status === "todo") },
  { id: "in-progress", label: "In progress", tasks: operatorTasks.filter((task) => task.status === "in-progress") },
  { id: "done", label: "Done", tasks: operatorTasks.filter((task) => task.status === "done") }
];

export const knowledgeStages = [
  { id: "captured", label: "Captured", items: knowledgeItems.filter((item) => item.status === "captured") },
  { id: "learned", label: "Learned", items: knowledgeItems.filter((item) => item.status === "learned") },
  { id: "output", label: "Output", items: knowledgeItems.filter((item) => item.status === "output") }
];

export const contentStages = [
  { id: "idea", label: "Idea", items: contentItems.filter((item) => item.status === "idea") },
  { id: "draft", label: "Draft", items: contentItems.filter((item) => item.status === "draft") },
  { id: "scheduled", label: "Scheduled", items: contentItems.filter((item) => item.status === "scheduled") },
  { id: "published", label: "Published", items: contentItems.filter((item) => item.status === "published") }
];

export const highPriorityTasks = operatorTasks.filter((task) => task.priority === "High");
export const openTasks = operatorTasks.filter((task) => task.status !== "done");
export const completedTasks = operatorTasks.filter((task) => task.status === "done");
