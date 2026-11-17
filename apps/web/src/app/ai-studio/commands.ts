export const commandGroups = [
  {
    id: "research", label: "资料研究",
    note: "围绕季度发布计划，从检索资料到形成结论。",
    tools: [
      ["research-run", "调研发布计划", "研究记录保留了查询、查阅来源和整理发现三个阶段，可以展开查看进展。"],
      ["ai-answer", "回答并引用资料", "打开带行内引文的答复，查看每个结论对应的来源。"],
      ["source-cards", "查看引用来源", "这里是支撑答复的参考资料。可以翻看来源并检查片段。"],
      ["vector-search", "查看语义检索", "检查候选文档在向量空间的位置，并调整返回的结果数量。"],
      ["reasoning-block", "查看答复步骤", "以下是示例任务的步骤摘要。展开即可查看从查找资料到整理答复的过程。"],
      ["reasoning-tree", "比较推演分支", "对比不同假设下的处理路线，查看各分支如何收敛。"],
      ["tool-call", "检查工具调用", "展开工具记录可以核对输入、输出和执行状态。"],
      ["document-extract", "提取文档字段", "在原文与提取结果之间切换，检查哪些字段需要人工审核。"],
      ["tldr-toggle", "压缩阅读材料", "可在全文、摘要与要点之间切换，并改变摘要长度。"],
    ],
  },
  {
    id: "agent", label: "Agent 执行",
    note: "先制定计划，再检查代理的工具、交接和运行结果。",
    tools: [
      ["agent-plan", "制定执行计划", "下面是一份可审阅的计划。先确认步骤，再决定是否运行本地演示。"],
      ["agent-run", "运行任务预演", "运行一轮示例任务，观察步骤进度和中途停止的状态。"],
      ["agent-loop", "观察执行循环", "从计划、调用工具、观察到调整，查看代理如何推进一轮任务。"],
      ["agent-timeline", "查看协作时间线", "沿时间线检查每个代理的处理窗口与交接。"],
      ["agent-status", "查看代理状态", "可在准备、执行和完成之间切换，检查状态如何反馈。"],
      ["agent-cursor", "查看协作编辑", "检查代理提出的文档更改并决定是否接受。"],
      ["agent-handoff", "转交给人工", "用客服示例模拟从助手到人工的交接过程。"],
      ["ai-workflow", "编辑工作流", "在示例流程中调整步骤，再运行一次以查看分支结果。"],
      ["ticket-router", "分派支持工单", "用示例工单观察分类、路由及低置信度的人工审核。"],
      ["connector-setup", "连接工作区工具", "选择一个示例连接并检查连接状态。"],
    ],
  },
  {
    id: "writing", label: "内容与代码",
    note: "把同一段工作信息整理成可修改、可检查的产出。",
    tools: [
      ["reply-draft", "起草一封回复", "从草稿开始，可以换语气、改长度，满意后选用这版文字。"],
      ["tone-tuner", "调整沟通语气", "试试不同语气和受众设定，查看原文和改写的差异。"],
      ["ai-inline-edit", "修改选中的文字", "选中示例文本的句子，体验只改写选区和审阅变动的流程。"],
      ["ai-translate", "翻译一段说明", "选择目标语言，然后对照原文和翻译结果。"],
      ["meeting-summary", "整理会议纪要", "从本地会议示例提取讨论摘要和后续事项，逐项查看并确认。"],
      ["ghost-text", "试用行内补全", "继续输入草稿，按 Tab 接受补全建议。"],
      ["code-suggestion", "审阅代码建议", "逐段查看差异，选择接受或拒绝这份本地补丁。"],
      ["pii-redaction", "检查敏感信息", "用虚构文案对比原文和脱敏版本，检查检测出的字段。"],
      ["smart-form-fill", "从文本填写表单", "从示例签名提取字段，并检查标为需要复核的内容。"],
      ["starter-prompts", "挑选常用提示词", "选择一条提示词，确认内容后可以将它发送到这段对话。"],
    ],
  },
  {
    id: "data", label: "数据分析",
    note: "用示例数据问答、分析走势和查看数据流向。",
    tools: [
      ["ask-your-data", "提问并分析数据", "这里有本地数据的提问示例，可核对查询、结果和图表。"],
      ["ai-insight-card", "解释指标变化", "沿趋势图检查导致变化的因素，并切换要看的驱动项。"],
      ["enrich-column", "补全数据列", "对示例行运行字段补全，核对各行的处理结果。"],
      ["data-flow", "查看数据流向", "观察示例来源如何流向处理步骤和最终输出。"],
      ["realtime-stream", "观察实时变化", "观察模拟的处理量变化，查看最近一段时间的曲线。"],
      ["selection-toolbar", "批量整理数据", "勾选几条分析记录，让助手一次加入本地审阅清单。"],
    ],
  },
  {
    id: "model", label: "模型与评估",
    note: "比较模型、查看上下文和理解生成的成本。",
    tools: [
      ["model-arena", "并排比较模型", "在相同提示词下比较两组示例输出，检查内容差异。"],
      ["model-card", "了解所选模型", "查看模型示例的能力、基准与配置。"],
      ["prompt-studio", "编辑并试跑提示词", "改变提示词变量并试跑，比较输出是否符合要求。"],
      ["eval-suite", "检查评估结果", "按样本查看通过、失败和需要复核的结果。"],
      ["context-window", "检查上下文占用", "查看输入、历史消息和预留输出各占多少上下文。"],
      ["generation-stats", "查看生成统计", "查看本地生成示例的用量、耗时和速度。"],
      ["llm-cost-calculator", "估算模型用量成本", "调节每天的消息和 token 数，比较示例单价下的成本。"],
      ["prompt-cache", "查看提示词缓存", "对比首次输入和复用提示词时的缓存命中情况。"],
      ["speculative-decoding", "演示推测解码", "逐步看草稿模型给出的候选如何被校验、接受或替换。"],
      ["mixture-of-experts", "查看专家模型路由", "查看 token 进入哪些专家，以及路由如何分配负载。"],
      ["model-training", "观察模型训练过程", "逐步查看模型训练示例的输入、预测和更新。"],
      ["training-run", "观察训练任务", "跟踪训练任务的指标与检查点，并体验可恢复的失败状态。"],
      ["provider-status", "检查服务提供方状态", "下钻查看服务状态和示例事件。"],
      ["provider-keys", "体验模型凭据管理", "只使用虚构凭据体验设置、验证与移除。"],
      ["typewriter-terminal", "查看运行输出", "观察批处理的本地示例输出和状态变化。"],
    ],
  },
  {
    id: "media", label: "语音与图像",
    note: "观察语音状态、回放和图像生成过程。",
    tools: [
      ["voice-orb", "体验语音状态", "切换聆听、处理、说话状态，观察光球和反馈信息。"],
      ["voice-recorder", "试录一条语音", "使用模拟录音队列体验开始、停止和发送操作。"],
      ["dictation-button", "试用语音转文字", "启动示例听写并检查文本回填。"],
      ["speech-player", "试听文字播报", "切换声音与语速，查看播放中的逐词高亮。"],
      ["image-generation", "演示图像生成", "改变示例提示词、模型和比例，体验从等待到选择的过程。"],
      ["ai-mascot", "查看助手状态动画", "切换助手状态，并比较立方体、幽灵和像素形象。"],
      ["skeleton-morph", "重播生成等待状态", "重放从加载占位到生成结果的过渡。"],
    ],
  },
] as const;

export type StudioGroup = (typeof commandGroups)[number];
export type StudioCommand = StudioGroup["tools"][number];
export type ArtifactId = StudioCommand[0];

export const quickCommands = [
  "research-run", "agent-plan", "reply-draft", "ask-your-data", "voice-orb",
] as const satisfies readonly ArtifactId[];

export const studioCommands = commandGroups.flatMap((group) => Array.from<StudioCommand>(group.tools));
const byId = new Map<string, StudioCommand>(studioCommands.map((command) => [command[0], command]));

export function studioCommand(id: string): StudioCommand | undefined {
  return byId.get(id);
}

const basicAliases: Record<string, ArtifactId> = {
  summarize: "tldr-toggle", translate: "ai-translate", explain: "reasoning-block", fix: "code-suggestion",
};

export function resolveCommand(message: string): StudioCommand | undefined {
  const prompt = message.trim();
  const shorthand = prompt.match(/^\/?([a-z][\w-]*)(?:\s|$)/i)?.[1].toLowerCase();
  if (shorthand) {
    const command = studioCommand(shorthand) ?? studioCommand(basicAliases[shorthand]);
    if (command) return command;
  }
  return studioCommands.find(([, label]) => prompt === label)
    ?? (prompt.includes("翻译") ? studioCommand("ai-translate") : undefined)
    ?? (prompt.includes("调研") || prompt.includes("研究") ? studioCommand("research-run") : undefined)
    ?? (prompt.includes("计划") ? studioCommand("agent-plan") : undefined)
    ?? (prompt.includes("回复") ? studioCommand("reply-draft") : undefined)
    ?? (prompt.includes("数据") ? studioCommand("ask-your-data") : undefined);
}

export function followUpCommands(command: StudioCommand) {
  const group = commandGroups.find((entry) => Array.from<StudioCommand>(entry.tools).includes(command));
  if (!group) return [];
  const tools = Array.from<StudioCommand>(group.tools);
  const after = tools.indexOf(command) + 1;
  return tools.slice(after, after + 2).concat(tools.slice(0, Math.max(0, 2 - (tools.length - after))));
}
