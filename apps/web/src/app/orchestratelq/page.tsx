"use client";

import { Avatar } from "@/shared/arc/avatar/avatar";
import { Badge } from "@/shared/arc/badge/badge";
import { Button } from "@/shared/arc/button/button";
import { Input } from "@/shared/arc/input/input";
import { MetricCard } from "@/shared/arc/metric-card/metric-card";
import { ScrollArea } from "@/shared/arc/scroll-area/scroll-area";
import { ThemeSwitch } from "@/shared/arc/theme-switch/theme-switch";
import { Tooltip } from "@/shared/arc/tooltip/tooltip";
import { useThemeEditor } from "@/shared/providers/theme-provider";
import { DEFAULT_THEME, type ThemeId } from "@template/design-tokens/themes";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Database,
  Filter,
  Grid2X2,
  MessageCircle,
  Network,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const agents = [
  { name: "research_agent", role: "Specialist", calls: 188, icon: Search },
  { name: "supervisor", role: "Router", calls: 412, icon: Network },
  { name: "data_agent", role: "Specialist", calls: 204, icon: Database },
  { name: "validator_agent", role: "Validator", calls: 196, icon: ShieldCheck },
  { name: "responder", role: "Composer", calls: 404, icon: Send },
];

const events = [
  { name: "Delegating", status: "Healthy", start: 2, span: 3, agent: "supervisor" },
  { name: "Validating", status: "Healthy", start: 1, span: 3, agent: "validator_agent" },
  { name: "Validating", status: "Pending", start: 7, span: 3, agent: "data_agent" },
  { name: "Responding", status: "Healthy", start: 13, span: 3, agent: "responder" },
];

const times = [
  "09:41:00", "09:41:15", "09:41:30", "09:41:45", "09:42:00",
  "09:42:15", "09:42:30", "09:42:45", "09:43:00", "09:43:15",
  "09:43:30", "09:43:45", "09:44:00", "09:44:15", "09:44:30",
];

const workspaceLinks = [
  { label: "Overview", href: "#overview" },
  { label: "Workflows", href: "#next-steps" },
  { label: "Live map", href: "#live-map" },
  { label: "Insights", href: "#detected" },
];

const steps = [
  { title: "Name your workflows", description: "Runtime IDs are hard to read in an incident.", status: "Do first", detail: "2 workflows · 2 min" },
  { title: "Set a cost budget", description: "So anomaly detection has a baseline from day one.", detail: "$0 / day · Sep 9" },
  { title: "Invite your on-call", description: "Incidents need an owner before the first one opens." },
];

const metrics = [
  { label: "Agents", value: 6, context: "92% confidence" },
  { label: "Workflows", value: 2, context: "88% confidence" },
  { label: "Handoffs", value: 9, context: "2 unverified" },
  { label: "Events", value: 412, context: "Streaming" },
];

const prompts = [
  "Why is validator_agent still pending?",
  "Which agent is most likely to fail first?",
];

const panelClass = "min-w-0 rounded-[var(--radius-panel)] border border-border bg-surface p-4 sm:p-6";
const workspaceLinkClass = "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-foreground";

function WorkspaceHeader() {
  const { activeId, selectTheme } = useThemeEditor();
  const [lastLight, setLastLight] = useState<ThemeId>(DEFAULT_THEME);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[92rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 md:px-8">
        <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-control)] text-sm font-medium" aria-label="返回设计主题首页">
          <Grid2X2 size={16} aria-hidden="true" />
          OrchestrateIQ
        </Link>
        <nav className="order-3 flex w-full flex-wrap gap-1 md:order-none md:w-auto" aria-label="系统导航">
          {workspaceLinks.map((link) => <a key={link.href} className={workspaceLinkClass} href={link.href}>{link.label}</a>)}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone="success" dot>Live</Badge>
          <ThemeSwitch
            theme={activeId === "night" ? "dark" : "light"}
            variant="rise"
            iconOnly
            label="切换工作台明暗模式"
            onThemeChange={(next) => {
              if (next === "dark") setLastLight(activeId);
              selectTheme(next === "dark" ? "night" : lastLight);
            }}
          />
          <Tooltip content="Platform Team">
            <span className="hidden md:inline-flex"><Avatar name="Platform Team" size="sm" /></span>
          </Tooltip>
          <Button aria-label="通知" disabled className="hidden! lg:inline-flex!" size="sm" type="button" variant="ghost">
            <Bell size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function TimelineCard() {
  return (
    <section className={panelClass} id="overview" aria-labelledby="workspace-title">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <h1 id="workspace-title" className="text-[length:var(--text-3xl)] font-medium tracking-[var(--tracking-display)]">
            We found your system
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">Everything below was inferred from 412 events in 4 minutes. Nothing was declared by hand.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success" icon={<Check size={14} />}>Setup complete · 3 of 3</Badge>
          <Button disabled size="sm" type="button" variant="secondary">
            <CalendarDays size={14} aria-hidden="true" /> Sep 9, 2026 · 09:41 <ChevronDown size={14} aria-hidden="true" />
          </Button>
          <Button disabled size="sm" type="button" variant="secondary">
            <Filter size={14} aria-hidden="true" /> Filter
          </Button>
          <a href="#live-map" className={workspaceLinkClass}>Live map <ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
      </div>
      <ScrollArea
        className="min-w-0 rounded-[var(--radius-control)] border border-border"
        label="Agent activity timeline"
        orientation="horizontal"
        scrollbars="always"
        wheelToHorizontal={false}
      >
        <table className="min-w-[66rem] w-full table-fixed border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]">
            <tr>
              <th scope="col" className="w-44 px-3 py-3 font-medium">Agents</th>
              {times.map((time) => <th key={time} scope="col" className="px-1 py-3 text-center text-xs font-normal tabular-nums">{time}</th>)}
            </tr>
          </thead>
          <tbody>
            {agents.map(({ name, role, calls, icon: Icon }) => {
              const event = events.find((entry) => entry.agent === name);
              return (
                <tr className="[&>*]:border-t [&>*]:border-border" key={name}>
                  <th className="px-3 py-3 font-normal" scope="row">
                    <span className="flex items-center gap-2 font-medium"><Icon size={15} aria-hidden="true" />{name}</span>
                    <small className="text-[var(--text-secondary)] tabular-nums">{role} · {calls} calls</small>
                  </th>
                  {times.map((time, index) => {
                    if (event && index === event.start - 1) {
                      return <td key={time} className="border-l px-1.5" colSpan={event.span}><Badge tone={event.status === "Healthy" ? "success" : "warning"} dot>{event.name} · {event.status}</Badge></td>;
                    }
                    if (event && index >= event.start && index < event.start + event.span - 1) return null;
                    return <td key={time} className="border-l" />;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollArea>
    </section>
  );
}

function NextSteps() {
  return (
    <section className={panelClass} id="next-steps" aria-labelledby="next-steps-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="next-steps-heading" className="text-[length:var(--text-xl)] font-medium">Next steps</h2>
        <a href="#detected" className={workspaceLinkClass}>View detected <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
      <ul className="grid list-none divide-y divide-border">
        {steps.map((step) => (
          <li key={step.title} className="grid gap-1 py-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{step.title}</h3>
              {step.status && <Badge tone="warning" size="sm">{step.status}</Badge>}
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{step.description}</p>
            {step.detail && <p className="text-xs text-[var(--text-secondary)] tabular-nums">{step.detail}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Detected() {
  return (
    <section className="min-w-0 p-4 sm:p-6" id="detected" aria-labelledby="detected-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="detected-heading" className="text-[length:var(--text-xl)] font-medium">Detected</h2>
        <a href="#overview" className={workspaceLinkClass}>View overview <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
      <div className="grid gap-2 min-[365px]:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
    </section>
  );
}

function Assistant() {
  const [question, setQuestion] = useState("");

  return (
    <section className={panelClass} id="live-map" aria-labelledby="assistant-heading">
      <div className="mb-4 grid gap-1">
        <h2 id="assistant-heading" className="text-[length:var(--text-xl)] font-medium">Welcome, Nizam</h2>
        <p className="text-sm text-[var(--text-secondary)]">What can I help with today?</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled type="button" size="sm" variant="secondary"><Network size={14} aria-hidden="true" />Name workflows</Button>
        <Button disabled type="button" size="sm" variant="secondary"><MessageCircle size={14} aria-hidden="true" />Explain graph</Button>
        <Button disabled type="button" size="sm" variant="secondary"><Plus size={14} aria-hidden="true" />Invite team</Button>
      </div>
      <div className="my-4 grid gap-2 text-sm">
        <h3 className="font-medium">Ask about what we found</h3>
        {prompts.map((prompt) => (
          <Button type="button" size="sm" variant="secondary" className="justify-start! whitespace-normal!" key={prompt} onClick={() => setQuestion(prompt)}>
            <Sparkles size={14} aria-hidden="true" />
            <span className="whitespace-normal text-left">{prompt}</span>
          </Button>
        ))}
      </div>
      <div className="grid gap-2">
        <Input label="Ask me anything" maxLength={300} value={question} onChange={(event) => setQuestion(event.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">{question.length} / 300 · Preview</span>
          <Button disabled size="sm" type="button" variant="secondary"><Send size={14} aria-hidden="true" />Send</Button>
        </div>
      </div>
    </section>
  );
}

export default function OrchestrateIQPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <WorkspaceHeader />
      <main className="mx-auto grid max-w-[92rem] gap-6 px-4 py-6 md:px-8">
        <TimelineCard />
        <div className="grid items-start gap-4 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
          <NextSteps />
          <Detected />
          <Assistant />
        </div>
      </main>
    </div>
  );
}
