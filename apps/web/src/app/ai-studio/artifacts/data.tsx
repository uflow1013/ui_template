import { Checkbox } from "@/shared/arc/checkbox/checkbox";
import { AskYourData } from "@/shared/arc/pro/ask-your-data/ask-your-data";
import { DataFlow } from "@/shared/arc/pro/data-flow/data-flow";
import { EnrichColumn } from "@/shared/arc/pro/enrich-column/enrich-column";
import { RealtimeStream, type StreamPoint } from "@/shared/arc/pro/realtime-stream/realtime-stream";
import { SelectionToolbar } from "@/shared/arc/pro/selection-toolbar/selection-toolbar";
import { useEffect, useState } from "react";
import { AiInsightCard } from "../arc-blocks/ai-insight-card/ai-insight-card";
import styles from "../studio.module.css";

const initialPoints: StreamPoint[] = Array.from({ length: 31 }, (_, index) => (
  { t: index * 1000, value: Math.round(35 + 6 * Math.sin(index * 0.49)) }
));

function LocalStream() {
  const [points, setPoints] = useState(initialPoints);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPoints((current) => {
        const t = current.at(-1)!.t + 1000;
        return [...current.slice(-59), { t, value: Math.round(35 + 6 * Math.sin(t * 0.00049)) }];
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <RealtimeStream
    formatTime={(value) => `${Math.round(value / 1000)}s`}
    label="每秒处理的记录"
    points={points}
  />;
}

const records = ["渠道转化数据", "单日访问异常", "注册趋势"];

function ReviewSelection() {
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  return <div className={styles.optionDemo}>
    <div className={styles.reviewList}>
      {records.map((record) => <Checkbox key={record} checked={reviewed.includes(record) || selected.includes(record)}
        label={reviewed.includes(record) ? `${record}（已加入）` : record}
        disabled={reviewed.includes(record)}
        onCheckedChange={(checked) => setSelected((items) => checked ? [...items, record] : items.filter((item) => item !== record))}
      />)}
      <SelectionToolbar count={selected.length} noun="record" onClear={() => setSelected([])}
        actions={[{ label: "加入审阅清单", onClick: () => { setReviewed((items) => [...items, ...selected]); setSelected([]); } }]} />
      <p role="status">{reviewed.length ? `已加入 ${reviewed.length} 条记录。` : "选择需要审阅的记录。"}</p>
    </div>
  </div>;
}

export const artifacts = {
  "ask-your-data": () => <AskYourData autoRun />,
  "ai-insight-card": () => <AiInsightCard autoPlay={false} />,
  "enrich-column": () => <EnrichColumn />,
  "data-flow": () => <DataFlow caption="示例数据从接入、处理流向分析结果。" />,
  "realtime-stream": LocalStream,
  "selection-toolbar": ReviewSelection,
};
