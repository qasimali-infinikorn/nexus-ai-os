import {
  LayoutDashboard,
  Sparkles,
  Bot,
  Server,
  FileCode,
  Boxes,
  FolderKanban,
  FolderGit,
  Search,
  FileText,
  BookOpen,
  CalendarClock,
  Bell,
  Settings,
  type LucideIcon
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Count pill shown on the right of the nav row (mockup: Code Review, Notifications). */
  badge?: number;
  /** When set, the item is hidden unless this feature flag is on for the org. */
  featureFlag?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Your day at a glance." },
      {
        href: "/ai-workspace",
        label: "AI Workspace",
        icon: Sparkles,
        description: "Route a task to the right specialist and get an executive synthesis.",
        featureFlag: "ai-workspace"
      },
      { href: "/agents", label: "Agents", icon: Bot, description: "Specialist agents and their run history." }
    ]
  },
  {
    label: "Engineering",
    items: [
      {
        href: "/architecture",
        label: "Architecture",
        icon: Server,
        description: "Design system architectures with Mermaid diagrams you can export."
      },
      {
        href: "/code-review",
        label: "Code Review",
        icon: FileCode,
        description: "Staff-level reviews, SOLID checks, and technical debt estimates.",
        badge: 3
      },
      { href: "/devops", label: "DevOps", icon: Boxes, description: "Deployments and incidents." },
      { href: "/projects", label: "Projects", icon: FolderKanban, description: "Sprints and delivery health." }
    ]
  },
  {
    label: "Knowledge",
    items: [
      {
        href: "/knowledge-base",
        label: "Knowledge Base",
        icon: FolderGit,
        description: "Index internal standards and ask RAG questions against them."
      },
      {
        href: "/research-center",
        label: "Research Center",
        icon: Search,
        description: "Compare stacks, plan migrations, and gauge enterprise readiness."
      },
      {
        href: "/documentation",
        label: "Documentation",
        icon: BookOpen,
        description: "Generate READMEs, ADRs, API docs, and runbooks with Doc Architect."
      },
      {
        href: "/proposal-studio",
        label: "Proposal Studio",
        icon: FileText,
        description: "Turn problem specs into client-ready proposals in business language.",
        featureFlag: "proposal-studio"
      },
      {
        href: "/meetings",
        label: "Meetings",
        icon: CalendarClock,
        description: "Agendas and meeting prep.",
        featureFlag: "live-meetings"
      }
    ]
  },
  {
    label: "System",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell, description: "Mentions, reviews, and incidents.", badge: 4 },
      { href: "/settings", label: "Settings", icon: Settings, description: "Profile, team, security, and integrations." }
    ]
  }
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
