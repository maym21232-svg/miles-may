import { useEffect, useRef, useState } from "react";

export interface PaperOrder {
  side: "buy" | "sell";
  symbol: string;
  name: string | null;
  sector: string | null;
  reason: string;
  reference_close: number;
  decision_date: string;
}

export interface PaperPosition {
  symbol: string;
  name: string | null;
  sector: string | null;
  shares: number;
  entry_price: number;
  entry_date: string;
  mark_price: number | null;
}

export interface PaperReport {
  version: number;
  status: "ready" | "paused";
  reason: string | null;
  data_date: string | null;
  expected_date: string;
  coverage: number;
  cash: number;
  starting_cash: number;
  positions: PaperPosition[];
  pending: PaperOrder[];
  decisions: { date: string; orders: PaperOrder[] }[];
  fills: { date: string; side: "buy" | "sell"; symbol: string; shares: number; price: number }[];
  last_decision_date: string | null;
  method: string;
}

const money = (value: number) =>
  new Intl.NumberFormat("zh-CN", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export function expectedCloseDate(now = new Date()): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export function paperPaused(report: PaperReport | null, now = new Date()): boolean {
  return !!report && (report.status !== "ready" || report.data_date !== expectedCloseDate(now));
}

function OrderLane({ side, orders, empty, onSelect }: {
  side: "buy" | "sell";
  orders: PaperOrder[];
  empty: string;
  onSelect: (symbol: string) => void;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [paused, setPaused] = useState(false);
  const carousel = orders.length >= 4;
  const title = side === "buy" ? "模拟买入" : "模拟卖出";

  const move = (direction: -1 | 1) => {
    const list = track.current;
    if (!list) return;
    const limit = list.scrollWidth - list.clientWidth;
    if (limit <= 0) return;
    const step = (list.firstElementChild?.getBoundingClientRect().width ?? list.clientWidth) + 12;
    const next = direction > 0
      ? list.scrollLeft >= limit - 2 ? 0 : Math.min(limit, list.scrollLeft + step)
      : list.scrollLeft <= 2 ? limit : Math.max(0, list.scrollLeft - step);
    list.scrollTo({ left: next, behavior: "smooth" });
  };

  useEffect(() => {
    if (!carousel || paused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => move(1), 4500);
    return () => window.clearInterval(timer);
  }, [carousel, paused]);

  return (
    <section className={`paper-lane paper-lane-${side}`} aria-label={`${title}决定`}>
      <div className="paper-lane-heading">
        <h3>{title} <span>{orders.length}</span></h3>
        {carousel && <div className="paper-lane-controls">
          <button type="button" aria-label={`上一条${title}决定`} title="上一条" onClick={() => move(-1)}>‹</button>
          <button type="button" aria-label={`下一条${title}决定`} title="下一条" onClick={() => move(1)}>›</button>
        </div>}
      </div>
      {orders.length ? (
        <ul className={`paper-order-track${carousel ? " is-carousel" : ""}`} ref={track}
          onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
          onTouchStart={() => setPaused(true)}>
          {orders.map((order) => (
            <li key={`${order.side}-${order.symbol}`}>
              <button type="button" onClick={() => onSelect(order.symbol)}>
                <span className="paper-order-name"><strong>{order.symbol}</strong><span>{order.name || order.symbol}</span></span>
                <span className="paper-order-reason">{order.reason}</span>
                <span className="paper-order-price">参考收盘 {money(order.reference_close)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="paper-lane-empty">{empty}</p>}
    </section>
  );
}

export function PaperDesk({ report, error = false, onSelect, onRetry }: {
  report: PaperReport | null;
  error?: boolean;
  onSelect: (symbol: string) => void;
  onRetry?: () => void;
}) {
  const paused = paperPaused(report);
  const staleOnDevice = report?.status === "ready" && report.data_date !== expectedCloseDate();
  const pending = paused ? [] : report?.pending ?? [];
  const valued = !!report && !paused && report.positions.every((position) =>
    position.mark_price != null && Number.isFinite(position.mark_price));
  const equity = valued && report
    ? report.cash + report.positions.reduce((sum, position) => sum + position.shares * position.mark_price!, 0)
    : null;
  const empty = error ? "数据不可用，暂不显示买卖决定" : !report ? "正在读取模拟记录…"
    : paused ? "行情滞后，暂停决策" : "本轮没有满足全部条件的决定";

  return (
    <section className="paper-desk" aria-label="每日模拟决策">
      <div className="paper-heading">
        <h2>每日模拟决策</h2>
        <span className={`paper-state${paused || error ? " paper-state-paused" : ""}`}>
          {error ? "数据不可用" : !report ? "加载中" : paused ? "已暂停" : "已评估"}
        </span>
      </div>
      {report && <p className="paper-asof">行情 {report.data_date || "未知"} · 最近决策 {report.last_decision_date || "尚无"}</p>}
      {report && paused && <p className="paper-warning" role="status">
        {staleOnDevice ? `最近一个工作日应为 ${expectedCloseDate()}，页面数据仍是 ${report.data_date || "未知"}` : report.reason}。本轮不显示买卖决定，也不执行旧挂单。
      </p>}
      {error && onRetry && <button className="paper-retry-button" type="button" onClick={onRetry}>重试</button>}
      <div className="paper-signals">
        <OrderLane side="buy" orders={pending.filter((order) => order.side === "buy")} empty={empty} onSelect={onSelect} />
        <OrderLane side="sell" orders={pending.filter((order) => order.side === "sell")} empty={empty} onSelect={onSelect} />
      </div>
      {report && <details className="paper-research">
        <summary>研究详情与虚拟仓</summary>
        <div className="paper-research-content">
          <p className="paper-equity">模拟起始资金 {money(report.starting_cash)} · {equity === null ? "模拟资产暂不可估值" : <>模拟资产 <strong>{money(equity)}</strong> <span>{`${((equity / report.starting_cash - 1) * 100).toFixed(2)}%`}</span></>}</p>
          <h3>虚拟持仓 <span>{report.positions.length}</span></h3>
          {report.positions.length ? (
            <ul className="paper-positions">
              {report.positions.map((position) => (
                <li key={position.symbol}>
                  <button type="button" onClick={() => onSelect(position.symbol)}>
                    <strong>{position.symbol}</strong><span>{position.name || position.symbol}</span><small>{position.shares} 股</small>
                  </button>
                  <p>模拟买入 {money(position.entry_price)} · {position.entry_date}{position.mark_price != null ? ` · 最近收盘 ${money(position.mark_price)}` : ""}</p>
                </li>
              ))}
            </ul>
          ) : <p className="paper-none">目前空仓 · 现金 {money(report.cash)}</p>}
          {(report.decisions.length > 0 || report.fills.length > 0) && (
            <div className="paper-history">
              <h3>历史决策与模拟成交</h3>
              <div className="paper-history-columns">
                <div><h4>决策</h4><ul>{report.decisions.slice(-7).reverse().map((day) => (
                  <li key={day.date}>{day.date} · {day.orders.length ? day.orders.map((order) => `${order.side === "buy" ? "买" : "卖"} ${order.symbol}`).join("、") : "空仓观察"}</li>
                ))}</ul></div>
                <div><h4>模拟成交</h4><ul>{report.fills.slice(-7).reverse().map((fill, index) => (
                  <li key={`${fill.date}-${fill.symbol}-${index}`}>{fill.date} · {fill.side === "buy" ? "买" : "卖"} {fill.symbol} {fill.shares} 股 @ {money(fill.price)}</li>
                ))}{report.fills.length === 0 && <li>尚无成交</li>}</ul></div>
              </div>
            </div>
          )}
          <h3>规则与风险</h3>
          <p className="paper-method">挂单须等次日开盘数据到齐才记为持仓；{report.method} 遇到美股休市、缺失或滞后的行情会暂停。</p>
          <p className="paper-disclaimer">仅为规则模拟，不存在 100% 确定的交易，也不是我逐股实时判断。</p>
        </div>
      </details>}
    </section>
  );
}
