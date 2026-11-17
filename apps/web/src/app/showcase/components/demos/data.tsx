"use client";

import { AvatarGroup } from "@/shared/arc/avatar-group/avatar-group";
import { Avatar } from "@/shared/arc/avatar/avatar";
import { Badge } from "@/shared/arc/badge/badge";
import { Card } from "@/shared/arc/card/card";
import { Progress } from "@/shared/arc/progress/progress";
import { SortableDataTable } from "@/shared/arc/sortable-data-table/sortable-data-table";
import { Button } from "@/shared/arc/button/button";
import { ArrowRight, Check } from "lucide-react";
import { row, useNotify } from "./demo-utils";

export function BadgeDemo() {
  return (
    <div className={row}>
      <Badge>进行中</Badge>
      <Badge tone="success" icon={<Check aria-hidden="true" />}>
        已完成
      </Badge>
      <Badge tone="warning" outline>待确认</Badge>
      <Badge tone="danger">需处理</Badge>
    </div>
  );
}

export function CardDemo() {
  const notify = useNotify();
  return (
    <Card
      className="w-full max-w-sm"
      title="澄光品牌焕新"
      description="品牌设计 · 更新于 10 分钟前"
      status="距离目标更近一步"
      action={
        <Button
          size="sm"
          variant="secondary"
          onClick={() => notify("已打开示例项目")}
        >
          查看项目
          <ArrowRight data-icon="inline-end" />
        </Button>
      }
    >
      <Progress value={78} label="项目进度" showValue />
    </Card>
  );
}

export function AvatarDemo() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <Avatar size="lg" name="林然" status="online" />
      <Avatar name="陈言" />
      <Avatar size="sm" name="周宁" />
      <AvatarGroup
        label="示例项目成员"
        members={["林然", "陈言", "周宁", "张岚", "何川", "许晨"].map((name) => ({ name }))}
        max={3}
      />
    </div>
  );
}

export function TableDemo() {
  return (
    <div className="w-full">
      <SortableDataTable
        caption="最近更新的 3 个示例项目"
        rowKey="name"
        rows={[
          { name: "品牌焕新", status: "进行中", tone: "info" as const, progress: 78 },
          { name: "官网设计", status: "待确认", tone: "warning" as const, progress: 92 },
          { name: "组件整理", status: "已完成", tone: "success" as const, progress: 100 },
        ]}
        columns={[
          { key: "name", label: "项目名称", sortable: false },
          {
            key: "status",
            label: "状态",
            sortable: false,
            render: (_, item) => <Badge tone={item.tone}>{item.status}</Badge>,
          },
          {
            key: "progress",
            label: "进度",
            sortable: false,
            numeric: true,
            render: (_, item) => `${item.progress}%`,
          },
        ]}
      />
    </div>
  );
}
