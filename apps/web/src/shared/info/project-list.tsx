import { Progress } from "@/shared/arc/progress/progress";

export const sampleProjects = [
  {
    id: "brand-refresh",
    name: "澄光品牌焕新",
    category: "品牌设计",
    progress: 78,
    due: "10 月 28 日",
  },
  {
    id: "member-program",
    name: "春日会员计划",
    category: "产品体验",
    progress: 52,
    due: "11 月 4 日",
  },
  {
    id: "customer-journey",
    name: "客户旅程梳理",
    category: "研究与策略",
    progress: 34,
    due: "11 月 12 日",
  },
];

export function ProjectList({ projects }: { projects: typeof sampleProjects }) {
  return (
    <table aria-label="示例项目进度" className="w-full table-fixed border-collapse border-t border-border text-sm">
      <colgroup>
        <col />
        <col className="w-[35%] sm:w-[27%]" />
        <col className="hidden w-[21%] sm:table-column" />
      </colgroup>
      <thead className="border-b border-border text-left text-xs text-[var(--text-secondary)]">
        <tr>
          <th className="py-3 pr-3 font-normal" scope="col">项目</th>
          <th className="py-3 font-normal" scope="col">进度</th>
          <th className="hidden py-3 pl-4 font-normal sm:table-cell" scope="col">截止日期</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {projects.map((project) => (
          <tr className="text-foreground" key={project.id}>
            <th className="py-3 pr-2 text-left font-medium" scope="row">
              {project.name}
              <span className="mt-0.5 block text-xs font-normal text-[var(--text-secondary)]">
                {project.category}
                <span className="block sm:hidden">{project.due}</span>
              </span>
            </th>
            <td className="py-3">
              <div className="flex items-center gap-2">
                <span className="sr-only" id={`progress-${project.id}`}>{project.name}进度</span>
                <Progress aria-labelledby={`progress-${project.id}`} className="min-w-0 flex-1" value={project.progress} />
                <span aria-hidden="true" className="text-xs tabular-nums">{project.progress}%</span>
              </div>
            </td>
            <td className="hidden py-3 pl-4 text-xs text-[var(--text-secondary)] sm:table-cell">{project.due}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
