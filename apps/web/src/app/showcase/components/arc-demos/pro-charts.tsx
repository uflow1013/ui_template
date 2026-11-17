"use client";

import { useState } from "react";
import { Button } from "@/shared/arc/button/button";
import { ActivityRings } from "@/shared/arc/pro/activity-rings/activity-rings";
import { DataGrid } from "@/shared/arc/pro/data-grid/data-grid";
import { FunnelChart } from "@/shared/arc/pro/funnel-chart/funnel-chart";
import { MetricTicker } from "@/shared/arc/pro/metric-ticker/metric-ticker";
import { RaceBarChart } from "@/shared/arc/pro/race-bar-chart/race-bar-chart";
import { RadarChart } from "@/shared/arc/pro/radar-chart/radar-chart";
import { RealtimeStream, type StreamPoint } from "@/shared/arc/pro/realtime-stream/realtime-stream";
import { SankeyFlow } from "@/shared/arc/pro/sankey-flow/sankey-flow";
import { SplitBar } from "@/shared/arc/pro/split-bar/split-bar";
import { Sunburst } from "@/shared/arc/pro/sunburst/sunburst";

export function ActivityRingsDemo() {
  return <ActivityRings
    label="目标进度"
    metrics={[
      { id: "move", label: "步行", unit: "步", goal: 6000 },
      { id: "train", label: "锻炼", unit: "分钟", goal: 30, color: "var(--chart-2)" },
      { id: "rest", label: "静心", unit: "分钟", goal: 10, color: "var(--chart-3)" },
    ]}
    days={[
      { id: "mon", label: "周一", short: "一", values: { move: 6150, train: 27, rest: 10 } },
      { id: "tue", label: "周二", short: "二", values: { move: 3800, train: 35, rest: 8 } },
      { id: "wed", label: "周三", short: "三", values: { move: 5120, train: 15, rest: 11 } },
      { id: "thu", label: "周四", short: "四", values: { move: 6330, train: 31, rest: 5 } },
      { id: "fri", label: "周五", short: "五", values: { move: 7960, train: 20, rest: 12 } },
    ]}
  />;
}

export function DataGridDemo() {
  return <DataGrid
    label="双击单元格编辑项目记录"
    maxHeight={250}
    columns={[
      { key: "project", label: "项目", editable: true, width: 180 },
      { key: "team", label: "团队", type: "select", options: ["设计", "前端", "产品"], editable: true },
      { key: "tasks", label: "完成任务数", type: "number", editable: true, width: 120 },
      { key: "date", label: "发布日期", type: "date", editable: true, width: 130 },
    ]}
    defaultRows={[
      { id: "palette", project: "颜色系统", team: "设计", tasks: 8, date: "2026-11-18" },
      { id: "docs", project: "组件文档", team: "前端", tasks: 10, date: "2026-11-20" },
      { id: "research", project: "体验访谈", team: "产品", tasks: 3, date: "2026-11-24" },
      { id: "refresh", project: "首页更新", team: "设计", tasks: 6, date: "2026-11-26" },
    ]}
  />;
}

export function FunnelChartDemo() {
  return <FunnelChart
    className="w-full"
    label="预览站使用转化"
    unit="次"
    height={240}
    stages={[
      { key: "visit", label: "访问", value: 1820 },
      { key: "browse", label: "浏览组件", value: 1180 },
      { key: "try", label: "试玩组件", value: 790 },
      { key: "copy", label: "复制引用", value: 430 },
    ]}
  />;
}

export function MetricTickerDemo() {
  const [secondDay, setSecondDay] = useState(false);
  return (
    <div className="grid w-full min-w-0 gap-3">
      <MetricTicker
        label="站点核心指标"
        metrics={[
          { id: "visits", label: "组件访问", value: secondDay ? 5310 : 4820, delta: "percent", history: [3720, 4060, 4590, 4820] },
          { id: "copies", label: "复制引用", value: secondDay ? 392 : 352, delta: "absolute", history: [238, 270, 309, 352] },
          { id: "latency", label: "响应延迟", value: secondDay ? 130 : 148, positive: "down", history: [177, 166, 152, 148], caption: "ms" },
        ]}
      />
      <Button variant="secondary" size="sm" onClick={() => setSecondDay(!secondDay)} className="justify-self-start">
        {secondDay ? "还原基线" : "载入下一次采样"}
      </Button>
    </div>
  );
}

export function RaceBarChartDemo() {
  return <RaceBarChart
    className="w-full"
    label="工作区每周使用次数"
    items={[
      { id: "color", label: "颜色系统" },
      { id: "showcase", label: "组件预览" },
      { id: "studio", label: "AI 展示台" },
      { id: "pattern", label: "页面模式" },
    ]}
    frames={[
      { period: "第 1 周", values: { color: 216, showcase: 311, studio: 123, pattern: 181 } },
      { period: "第 2 周", values: { color: 271, showcase: 343, studio: 250, pattern: 229 } },
      { period: "第 3 周", values: { color: 296, showcase: 374, studio: 412, pattern: 289 } },
      { period: "第 4 周", values: { color: 362, showcase: 501, studio: 476, pattern: 321 } },
    ]}
    autoPlay={false}
  />;
}

export function RadarChartDemo() {
  return <RadarChart
    className="w-full"
    label="版本体验评估"
    max={100}
    axes={[
      { key: "clarity", label: "清晰度" },
      { key: "speed", label: "速度" },
      { key: "theme", label: "主题" },
      { key: "a11y", label: "可访问" },
      { key: "setup", label: "易接入" },
    ]}
    series={[
      { key: "base", label: "上个版本", values: { clarity: 64, speed: 85, theme: 54, a11y: 64, setup: 58 } },
      { key: "now", label: "当前版本", values: { clarity: 91, speed: 88, theme: 92, a11y: 84, setup: 91 } },
    ]}
  />;
}

const streamValues = [126, 139, 147, 133, 128, 144, 162, 153, 132, 140, 163, 145];
const startTime = Date.UTC(2026, 10, 17, 9);

export function RealtimeStreamDemo() {
  const [points, setPoints] = useState<StreamPoint[]>(() => Array.from(
    { length: 25 }, (_, index) => ({ t: startTime + index * 1000, value: streamValues[index % streamValues.length] }),
  ));

  function addSample() {
    setPoints((existing) => {
      const nextTime = existing[existing.length - 1].t + 1000;
      const phase = (nextTime - startTime) / 1000;
      const spike = phase % 5 === 0;
      return [...existing.slice(-30), {
        t: nextTime,
        value: (spike ? 63 : 0) + streamValues[phase % streamValues.length],
        anomaly: spike ? "延迟升高" : undefined,
      }];
    });
  }

  return (
    <div className="grid w-full min-w-0 gap-3">
      <RealtimeStream className="w-full" points={points} label="服务延迟" unit="ms" height={150} />
      <Button size="sm" variant="secondary" className="justify-self-start" onClick={addSample}>追加采样</Button>
    </div>
  );
}

export function SankeyFlowDemo() {
  return <SankeyFlow
    className="w-full"
    label="工作区导航流向"
    unit="次"
    height={240}
    nodes={[
      { id: "home", label: "首页", column: 0 },
      { id: "search", label: "站内搜索", column: 0 },
      { id: "showcase", label: "组件预览", column: 1 },
      { id: "guide", label: "设计文档", column: 1 },
      { id: "copy", label: "复制引用", column: 2 },
      { id: "read", label: "继续浏览", column: 2 },
    ]}
    links={[
      { source: "home", target: "showcase", value: 280 },
      { source: "home", target: "guide", value: 90 },
      { source: "search", target: "showcase", value: 190 },
      { source: "search", target: "guide", value: 100 },
      { source: "showcase", target: "copy", value: 300 },
      { source: "showcase", target: "read", value: 170 },
      { source: "guide", target: "read", value: 190 },
    ]}
    particleToggle
  />;
}

export function SplitBarDemo() {
  return <SplitBar
    className="w-full"
    label="组件库访问来源"
    title="访问来源"
    unit="次"
    totalLabel="总访问"
    segments={[
      { id: "organic", label: "自然搜索", value: 1480 },
      { id: "team", label: "团队链接", value: 972 },
      { id: "docs", label: "设计文档", value: 360 },
    ]}
  />;
}

export function SunburstDemo() {
  return <Sunburst
    label="产品团队工作量"
    data={{
      id: "all", label: "产品团队", children: [
        { id: "design", label: "设计", children: [
          { id: "tokens", label: "设计规范", value: 25 },
          { id: "patterns", label: "页面模式", value: 21 },
        ] },
        { id: "engineering", label: "开发", children: [
          { id: "components", label: "组件库", value: 36 },
          { id: "infra", label: "基础设施", value: 18 },
        ] },
      ],
    }}
  />;
}
