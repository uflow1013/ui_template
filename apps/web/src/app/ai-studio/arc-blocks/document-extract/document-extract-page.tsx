"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { animate, useMotionValue } from "motion/react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Mail, Minus, Plus } from "lucide-react";
import { Tooltip } from "@/shared/arc/tooltip/tooltip";
import { motionTokens } from "@/shared/arc/lib/motion-tokens";
import { kindOf, richText, type DocBlock, type DocLogo, type Rich, type SourceDocument } from "./document-extract-data";
import styles from "./document-extract.module.css";

const { spring } = motionTokens;
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** How a cited span is drawn: its field, its series color, and whether that value still needs a check. */
export interface SpanLink { path: string; label: string; tone: "ok" | "check"; color: number }

/** Natural page width in CSS pixels. A4 is 1 : 1.414, so a sheet is 540 by 764 at 100%. */
const PAGE_WIDTH = 540;
const STEPS = [.5, .67, .75, .9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const MIN = .4, MAX = 2;
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

/* ---------------------------------------------------------------------------------------------------------------
 * Small marks
 * ------------------------------------------------------------------------------------------------------------- */

/** A file type mark: a folded sheet with a red band, the way most viewers mark a PDF. */
function PdfMark() {
  return <svg className={styles.fileMark} viewBox="0 0 16 20" aria-hidden="true">
    <path d="M2.5 1h7.2L14 5.3v12.2c0 .8-.7 1.5-1.5 1.5h-10C1.7 19 1 18.3 1 17.5v-15C1 1.7 1.7 1 2.5 1Z" fill="var(--surface)" stroke="currentColor" strokeOpacity=".32" />
    <path d="M9.7 1v3.1c0 .7.5 1.2 1.2 1.2H14" fill="none" stroke="currentColor" strokeOpacity=".32" />
    <rect x="0" y="10" width="11" height="6" rx="1.5" fill="#d93a32" />
    <path d="M2 14.6v-3.2h1.2c.6 0 1 .4 1 1s-.4 1-1 1H2M5.2 14.6v-3.2h.9c.9 0 1.5.6 1.5 1.6s-.6 1.6-1.5 1.6h-.9ZM8.5 14.6v-3.2h1.6M8.5 13h1.3" fill="none" stroke="#fff" strokeWidth=".8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function LogoSymbol({ symbol }: { symbol: DocLogo["symbol"] }) {
  if (symbol === "petals") return <svg className={styles.logoSymbol} viewBox="0 0 20 20" aria-hidden="true">
    {[0, 120, 240].map(angle => <ellipse key={angle} cx="10" cy="6.4" rx="3.3" ry="5.4" fill="currentColor" fillOpacity=".78" transform={`rotate(${angle} 10 11)`} />)}
  </svg>;
  if (symbol === "peak") return <svg className={styles.logoSymbol} viewBox="0 0 20 20" aria-hidden="true"><path d="M1.5 16.5 7.6 6.2l3.1 5.1 2-3.2 5.8 8.4Z" fill="currentColor" /></svg>;
  return null;
}

function Logo({ logo }: { logo: DocLogo }) {
  return <span className={styles.logo} style={logo.color ? { color: logo.color } : undefined}>
    <LogoSymbol symbol={logo.symbol} />
    <span className={styles.logoName}>{logo.name}</span>
    {logo.detail && <span className={styles.logoDetail}>{logo.detail}</span>}
  </span>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * The page
 * ------------------------------------------------------------------------------------------------------------- */

interface PageProps {
  document: SourceDocument;
  links: Map<string, SpanLink>;
  lit: Set<string>;
  /** Changes once per run; each change plays the scan pass once. 0 shows none. */
  scanKey: number;
  reduced: boolean;
  onSpanHover: (path: string | null) => void;
  onSpanPress: (path: string) => void;
  onBackgroundPress: () => void;
  pageRef?: RefObject<HTMLElement | null>;
  style?: CSSProperties;
}

/**
 * The document drawn as printed matter: an A4 sheet for a PDF, a message view for an email. Paper stays white in both themes.
 * Source spans are inline marks with a faint tint in their field's color once a value cites them, and a stronger tint while lit.
 */
export function DocumentPage({ document, links, lit, scanKey, reduced, onSpanHover, onSpanPress, onBackgroundPress, pageRef, style }: PageProps) {
  const kind = kindOf(document);
  const brand = document.blocks.find((block): block is Extract<DocBlock, { type: "masthead" }> => block.type === "masthead" && !!block.logo)?.logo?.color;

  const rich = (value: Rich): ReactNode => typeof value === "string" ? value : value.map((part, index) => {
    if (typeof part === "string") return <Fragment key={index}>{part}</Fragment>;
    const link = links.get(part.span);
    return <span key={index} className={styles.span} data-span={part.span} data-linked={link ? "" : undefined} data-tone={link?.tone} data-lit={lit.has(part.span) ? "" : undefined}
      style={link ? { "--tone": `var(--series-${link.color})` } as CSSProperties : undefined}>{part.text}</span>;
  });

  const block = (item: DocBlock, key: number): ReactNode => {
    switch (item.type) {
      case "masthead": return <div key={key} className={styles.masthead}>
        {item.logo ? <Logo logo={item.logo} /> : <span />}
        {item.title && <p className={styles.docTitle}>{item.title}</p>}
      </div>;
      case "email": {
        const initials = richText(item.from.name).split(/\s+/).map(word => word[0]).join("").slice(0, 2);
        return <div key={key} className={styles.mailHead}>
          <p className={styles.mailSubject}>{rich(item.subject)}</p>
          <div className={styles.mailFrom}>
            <span className={styles.mailAvatar} style={brand ? { background: brand } : undefined} aria-hidden="true">{initials}</span>
            <div className={styles.mailWho}>
              <p><span className={styles.mailName}>{rich(item.from.name)}</span> <span className={styles.inkMuted}>&lt;{item.from.address}&gt;</span></p>
              <p className={styles.inkMuted}>To {item.to}</p>
            </div>
            <p className={cx(styles.mailDate, styles.inkMuted)}>{item.date}</p>
          </div>
        </div>;
      }
      case "heading": return <p key={key} className={styles.docHeading}>{rich(item.text)}</p>;
      case "paragraph": return <p key={key} className={cx(styles.docText, item.tone === "muted" && styles.inkMuted)}>{rich(item.text)}</p>;
      case "lines": return <div key={key} className={styles.docLines}>
        {item.label && <p className={styles.docLabel}>{item.label}</p>}
        {item.lines.map((line, index) => <p key={index}>{rich(line)}</p>)}
      </div>;
      case "pairs": return <dl key={key} className={styles.docPairs}>
        {item.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{rich(value)}</dd></div>)}
      </dl>;
      case "meta": return <dl key={key} className={styles.docMeta} style={{ "--count": item.items.length } as CSSProperties}>
        {item.items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{rich(value)}</dd></div>)}
      </dl>;
      case "columns": return <div key={key} className={styles.docColumns}>{item.columns.map((column, index) => <div key={index}>{column.map(block)}</div>)}</div>;
      case "table": return <table key={key} className={styles.docTable}>
        <thead><tr>{item.columns.map(column => <th key={column.label} scope="col" data-align={column.align}>{column.label}</th>)}</tr></thead>
        <tbody>{item.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} data-align={item.columns[c]?.align}>
          {rich(cell)}
          {c === 0 && item.details?.[r] && <span className={styles.docDetail}>{item.details[r]}</span>}
        </td>)}</tr>)}</tbody>
      </table>;
      case "totals": return <dl key={key} className={styles.docTotals}>
        {item.rows.map((row, index) => <div key={index} data-strong={row.strong ? "" : undefined}><dt>{rich(row.label)}</dt><dd>{rich(row.value)}</dd></div>)}
      </dl>;
      case "rule": return <hr key={key} className={styles.docRule} />;
      case "footer": return <div key={key} className={styles.docFooter}>
        <div>{item.lines.map((line, index) => <p key={index}>{rich(line)}</p>)}</div>
        {kind === "pdf" && <p>Page 1 of 1</p>}
      </div>;
    }
  };

  // One delegated listener for every span, so hover follows the pointer between neighbouring marks without gaps.
  const linkFrom = (target: EventTarget) => {
    const span = (target as HTMLElement).closest<HTMLElement>("[data-span][data-linked]");
    return span ? links.get(span.dataset.span ?? "") ?? null : null;
  };

  return <article ref={pageRef} className={styles.page} data-kind={kind} aria-label={document.name} style={style}
    onPointerOver={(event: ReactPointerEvent) => { if (event.pointerType === "mouse") onSpanHover(linkFrom(event.target)?.path ?? null); }}
    onPointerLeave={(event: ReactPointerEvent) => { if (event.pointerType === "mouse") onSpanHover(null); }}
    onClick={event => { const link = linkFrom(event.target); if (link) onSpanPress(link.path); else onBackgroundPress(); }}>
    {kind === "email"
      ? <>{document.blocks.filter(item => item.type === "email").map(block)}<div className={styles.mailBody}>{document.blocks.filter(item => item.type !== "email").map(block)}</div></>
      : document.blocks.map(block)}
    {scanKey > 0 && !reduced && <div key={scanKey} className={styles.scan} aria-hidden="true"><span className={styles.scanBeam} /></div>}
  </article>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * The viewer: a slim toolbar, zoom, and the page on a canvas
 * ------------------------------------------------------------------------------------------------------------- */

export interface ViewerFile { id: string; name: string; label: string; kind: "pdf" | "email"; meta?: string }

interface ViewerProps extends Omit<PageProps, "pageRef" | "style"> {
  /** Other documents to switch to from the file name. */
  files?: ViewerFile[];
  onFileChange?: (id: string) => void;
  canvasRef: RefObject<HTMLDivElement | null>;
}

function FileTitle({ document, files, onFileChange }: { document: SourceDocument; files?: ViewerFile[]; onFileChange?: (id: string) => void }) {
  const kind = kindOf(document);
  const icon = kind === "email" ? <Mail aria-hidden="true" className={styles.fileIcon} /> : <PdfMark />;
  if (!files || files.length < 2 || !onFileChange) return <span className={styles.fileTitle}>{icon}<span className={styles.fileName} title={document.name}>{document.name}</span></span>;
  return <Menu.Root modal={false}>
    <Menu.Trigger className={cx(styles.fileTitle, styles.fileButton)} aria-label={`${document.name}, switch document`}>
      {icon}<span className={styles.fileName}>{document.name}</span><ChevronDown aria-hidden="true" className={styles.fileChevron} />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Content className={styles.menu} align="start" sideOffset={6} collisionPadding={12}>
        <Menu.RadioGroup value={document.id} onValueChange={onFileChange}>
          {files.map(file => <Menu.RadioItem key={file.id} value={file.id} className={styles.menuItem}>
            {file.kind === "email" ? <Mail aria-hidden="true" className={styles.fileIcon} /> : <PdfMark />}
            <span className={styles.menuText}><span className={styles.menuName}>{file.name}</span>{file.meta && <span className={styles.menuMeta}>{file.meta}</span>}</span>
            <Menu.ItemIndicator className={styles.menuCheck}><Check aria-hidden="true" /></Menu.ItemIndicator>
          </Menu.RadioItem>)}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>;
}

export function DocumentViewer({ files, onFileChange, canvasRef, ...page }: ViewerProps) {
  const { document, reduced } = page;
  const kind = kindOf(document);
  const sizerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const zoom = useMotionValue(1);
  const [target, setTarget] = useState(1);
  const [fit, setFit] = useState(true);
  const fitRef = useRef(true);

  /** Writes a zoom straight to the DOM, so a zoom animation never re-renders the page. */
  const apply = useCallback((value: number) => {
    const sizer = sizerRef.current, node = pageRef.current;
    if (!sizer || !node) return;
    sizer.style.width = `${PAGE_WIDTH * value}px`;
    sizer.style.height = `${node.offsetHeight * value}px`;
    node.style.transform = `scale(${value})`;
  }, []);

  const fitZoom = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return 1;
    const style = getComputedStyle(canvas);
    const inner = canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return clamp(Math.floor((inner / PAGE_WIDTH) * 100) / 100);
  }, [canvasRef]);

  const zoomTo = useCallback((next: number, options: { fit?: boolean } = {}) => {
    const canvas = canvasRef.current;
    const value = clamp(next);
    fitRef.current = !!options.fit;
    setFit(!!options.fit);
    setTarget(value);
    if (!canvas) { zoom.jump(value); return; }
    // Keep the point at the middle of the canvas in place while the page grows or shrinks around it.
    const from = zoom.get(), pad = parseFloat(getComputedStyle(canvas).paddingTop);
    const cy = (canvas.scrollTop + canvas.clientHeight / 2 - pad) / from;
    const cxp = (canvas.scrollLeft + canvas.clientWidth / 2 - pad) / from;
    const settle = (v: number) => {
      apply(v);
      canvas.scrollTop = cy * v + pad - canvas.clientHeight / 2;
      canvas.scrollLeft = cxp * v + pad - canvas.clientWidth / 2;
    };
    if (reduced) { zoom.jump(value); settle(value); return; }
    animate(zoom, value, { ...spring.smooth, onUpdate: settle });
  }, [apply, canvasRef, reduced, zoom]);

  useEffect(() => zoom.on("change", apply), [zoom, apply]);

  // Fit to width on mount and whenever the canvas changes size while fit is on; follow the page's own height for messages.
  useLayoutEffect(() => {
    const canvas = canvasRef.current, node = pageRef.current;
    if (!canvas || !node) return;
    const refit = () => {
      if (fitRef.current) { const value = fitZoom(); zoom.jump(value); setTarget(value); }
      apply(zoom.get());
    };
    refit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(refit);
    observer.observe(canvas);
    observer.observe(node);
    return () => observer.disconnect();
  }, [apply, canvasRef, fitZoom, zoom, document.id]);

  const stepIn = () => zoomTo(STEPS.find(step => step > target + .005) ?? MAX);
  const stepOut = () => zoomTo([...STEPS].reverse().find(step => step < target - .005) ?? MIN);
  const percent = Math.round(target * 100);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.key === "=" || event.key === "+") { event.preventDefault(); stepIn(); }
    else if (event.key === "-") { event.preventDefault(); stepOut(); }
    else if (event.key === "0") { event.preventDefault(); zoomTo(fitZoom(), { fit: true }); }
  };

  return <section className={styles.viewer} aria-label="Document">
    <div className={styles.toolbar}>
      <FileTitle document={document} files={files} onFileChange={onFileChange} />
      <div className={styles.tools}>
        {kind === "pdf" && <span className={styles.pageCount} aria-label="Page 1 of 1">1 / 1</span>}
        <span className={styles.toolGroup} role="group" aria-label="Zoom">
          <Tooltip content="Zoom out"><button type="button" className={styles.tool} aria-label="Zoom out" aria-keyshortcuts="Control+-" disabled={target <= MIN + .005} onClick={stepOut}><Minus aria-hidden="true" /></button></Tooltip>
          <Tooltip content="Actual size"><button type="button" className={cx(styles.tool, styles.zoomValue)} aria-label={`Zoom ${percent}%, show at actual size`} onClick={() => zoomTo(1)}>{percent}%</button></Tooltip>
          <Tooltip content="Zoom in"><button type="button" className={styles.tool} aria-label="Zoom in" aria-keyshortcuts="Control+=" disabled={target >= MAX - .005} onClick={stepIn}><Plus aria-hidden="true" /></button></Tooltip>
        </span>
        <button type="button" className={cx(styles.tool, styles.fitButton)} aria-pressed={fit} aria-keyshortcuts="Control+0" onClick={() => zoomTo(fitZoom(), { fit: true })}>Fit</button>
      </div>
    </div>
    <div ref={canvasRef} className={styles.canvas} tabIndex={0} role="region" aria-label={`${document.name}, zoom ${percent}%`} onKeyDown={onKeyDown}>
      <div ref={sizerRef} className={styles.sizer}>
        <DocumentPage {...page} pageRef={pageRef} style={{ width: PAGE_WIDTH }} />
      </div>
    </div>
  </section>;
}
