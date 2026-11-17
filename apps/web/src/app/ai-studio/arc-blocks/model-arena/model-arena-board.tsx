"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Trophy } from "lucide-react";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { AnimatedCounter } from "@/shared/arc/animated-counter/animated-counter";
import { Button } from "@/shared/arc/button/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/arc/popover/popover";
import type { ArenaModel } from "./model-arena-data";
import { ModelMark, cx, standard } from "./model-arena-pane";
import styles from "./model-arena.module.css";

const { spring, duration } = motionTokens;
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
/** Rows that move on the board glide into place with no overshoot. */
const reorder = { ...spring.smooth, visualDuration: .34 };

export interface Record3 { wins: number; ties: number; losses: number }
export interface BoardRow { model: ArenaModel; record: Record3; battles: number; rate: number; color: string }

const zero: Record3 = { wins: 0, ties: 0, losses: 0 };

/** Ranks the pool by win rate, where a tie counts as half a win. Models without a battle sort last, in pool order. */
export function rankModels(pool: ArenaModel[], standings: Record<string, Record3>): BoardRow[] {
  const ranked = pool.map((model, index): { index: number; row: BoardRow } => {
    const record = standings[model.id] ?? zero;
    const battles = record.wins + record.ties + record.losses;
    return { index, row: { model, record, battles, rate: battles ? (record.wins + record.ties / 2) / battles * 100 : 0, color: model.color ?? SERIES[index % SERIES.length] } };
  });
  ranked.sort(({ row: a, index: ai }, { row: b, index: bi }) => (Number(b.battles > 0) - Number(a.battles > 0)) || (b.rate - a.rate) || (b.record.wins - a.record.wins) || (b.battles - a.battles) || (ai - bi));
  return ranked.map(item => item.row);
}

const signature = (rows: BoardRow[]) => rows.map(row => `${row.model.id}:${row.record.wins}/${row.record.ties}/${row.record.losses}`).join();

/** Height that follows its content on the smooth spring, so the popover never resizes in one frame. */
function useAutoHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, height };
}

/** The ranked rows. It mounts with the popover, so its height can follow the rows from the first frame. */
function BoardList({ shown, grow, reduced }: { shown: BoardRow[]; grow: boolean; reduced: boolean }) {
  const { ref, height } = useAutoHeight<HTMLDivElement>();
  const layout = reduced ? { duration: 0 } : reorder;
  return <motion.div className={styles.boardClip} initial={false} animate={{ height }} transition={reduced ? { duration: 0 } : spring.smooth}>
    <div ref={ref}>
      {shown.length ? <div className={styles.boardBody}>
        {/* Ranks stay put while rows glide past them, so a number never changes in motion. */}
        <ol className={styles.ranks} aria-hidden="true">{shown.map((row, index) => <li key={index}>{index + 1}</li>)}</ol>
        <ol className={styles.rows}>
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((row, index) => <motion.li key={row.model.id} layout="position" className={styles.row}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1 } }}
              transition={{ layout, opacity: { duration: reduced ? 0 : duration.fast, ease: standard } }}>
              <span className={styles.srOnly}>Rank {index + 1}, </span>
              <ModelMark model={row.model} />
              <span className={styles.rowName}>{row.model.name}</span>
              <span className={styles.rateTrack} aria-hidden="true">
                <motion.span className={styles.rateFill} style={{ background: row.color }} initial={grow ? { scaleX: 0 } : false} animate={{ scaleX: row.rate / 100 }} transition={grow ? { ...layout, delay: .12 } : layout} />
              </span>
              <span className={cx(styles.rateValue, styles.num)}><span className={styles.srOnly}>, win rate </span><AnimatedCounter value={Math.round(row.rate)} suffix="%" /></span>
            </motion.li>)}
          </AnimatePresence>
        </ol>
      </div> : <p className={styles.boardEmpty}>Vote on a round and the models you judged land here, ranked by win rate.</p>}
    </div>
  </motion.div>;
}

export interface LeaderboardProps {
  rows: BoardRow[];
  votes: number;
  /** A vote landed since the board was last opened. */
  fresh: boolean;
  /** The ranking just before that vote, so opening the board can replay the change. */
  before: BoardRow[] | null;
  reduced: boolean;
  onOpen: () => void;
  onReset: () => void;
}

/**
 * The top five on a small popover. Opening it after a vote replays that vote: rows start where they stood before it, then
 * glide to their new ranks while win rates roll and bars grow. After the first vote, the bars grow from empty.
 */
export function Leaderboard({ rows, votes, fresh, before, reduced, onOpen, onReset }: LeaderboardProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [replay, setReplay] = useState<BoardRow[] | null>(null);
  const [grow, setGrow] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    window.clearTimeout(timer.current);
    setReplay(null);
    setGrow(false);
    if (!next) return;
    onOpen();
    if (reduced || !fresh || !before) return;
    if (!before.some(row => row.battles > 0)) { setGrow(true); return; }
    if (signature(before) === signature(rows)) return;
    setReplay(before);
    timer.current = window.setTimeout(() => setReplay(null), 320);
  };

  const shown = (replay ?? rows).filter(row => row.battles > 0).slice(0, 5);

  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="sm" className={styles.boardButton} aria-label={fresh ? "Leaderboard, updated" : "Leaderboard"}>
        <span className={styles.boardIcon} aria-hidden="true"><Trophy /><span className={styles.boardDot} data-on={fresh || undefined} /></span>
        <span className={styles.boardLabel}>Leaderboard</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={8} className={styles.board} aria-labelledby={titleId}>
      <div className={styles.boardHead}>
        <h3 id={titleId} className={styles.boardTitle}>Leaderboard</h3>
        <span className={styles.boardMeta}>{votes === 0 ? "No votes yet" : `${votes} ${votes === 1 ? "vote" : "votes"}`}</span>
      </div>
      <BoardList shown={shown} grow={grow} reduced={reduced} />
      <div className={styles.boardFoot}>
        <span>A tie counts as half a win</span>
        <Button variant="ghost" size="sm" className={styles.resetButton} onClick={onReset} disabled={votes === 0}><RotateCcw aria-hidden="true" />Reset</Button>
      </div>
    </PopoverContent>
  </Popover>;
}
