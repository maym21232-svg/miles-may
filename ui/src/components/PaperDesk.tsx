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
  return (
    <section className="paper-desk" aria-label="每日模拟决策">
      <div className="paper-heading">
        <div>
          <span className="paper-kicker">短线观察</span>
          <h2>每日模拟决策</h2>
        </div>
        <span className={`paper-state${paused || error ? " paper-state-paused" : ""}`}>
          {error ? "数据不可用" : !report ? "加载中" : paused ? "已暂停" : "已评估"}
        </span>
      </div>

      {!report ? (
        <div className="paper-retry"><p className="paper-message" role={error ? "alert" : undefined}>
            {error ? "模拟决策数据暂时无法读取，不显示买卖建议。" : "正在读取模拟记录…"}
          </p>{error && onRetry && <button type="button" onClick={onRetry}>重试</button>}</div>
      ) : (
        <>
          <p className="paper-asof">行情 {report.data_date || "未知"} · 最近决策 {report.last_decision_date || "尚无"} · 模拟资金 {money(report.starting_cash)}</p>
          {paused && <p className="paper-warning" role="status">{staleOnDevice ? `最近一个工作日应为 ${expectedCloseDate()}，页面数据仍是 ${report.data_date || "未知"}` : report.reason}。本轮不显示买卖决定，也不执行旧挂单。</p>}
          <p className="paper-equity">{equity === null ? "模拟资产暂不可估值" : <>模拟资产 <strong>{money(equity)}</strong> <span>{`${((equity / report.starting_cash - 1) * 100).toFixed(2)}%`}</span></>}</p>
          <div className="paper-columns">
            <div className="paper-column">
              <h3>下次开盘待模拟执行 <span>{pending.length}</span></h3>
              {pending.length ? (
                <ul className="paper-list">
                  {pending.map((order) => (
                    <li key={`${order.side}-${order.symbol}`}>
                      <button type="button" onClick={() => onSelect(order.symbol)}>
                        <span className={`paper-action paper-action-${order.side}`}>{order.side === "buy" ? "模拟买入" : "模拟卖出"}</span>
                        <strong>{order.symbol}</strong><span className="paper-name">{order.name || order.symbol}</span>
                      </button>
                      <p>{order.reason} · 参考收盘价 {money(order.reference_close)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="paper-none">{paused ? "行情滞后，暂停决策" : "今天没有全部满足条件的买卖决定"}</p>}
            </div>
            <div className="paper-column">
              <h3>虚拟持仓 <span>{report.positions.length}</span></h3>
              {report.positions.length ? (
                <ul className="paper-list">
                  {report.positions.map((position) => (
                    <li key={position.symbol}>
                      <button type="button" onClick={() => onSelect(position.symbol)}>
                        <strong>{position.symbol}</strong><span className="paper-name">{position.name || position.symbol}</span>
                        <span className="paper-shares">{position.shares} 股</span>
                      </button>
                      <p>模拟买入 {money(position.entry_price)} · {position.entry_date}{position.mark_price != null ? ` · 最近收盘 ${money(position.mark_price)}` : ""}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="paper-none">目前空仓 · 现金 {money(report.cash)}</p>}
            </div>
          </div>
          {(report.decisions.length > 0 || report.fills.length > 0) && (
            <details className="paper-history">
              <summary>历史决策与模拟成交</summary>
              <div className="paper-history-columns">
                <div><h3>决策</h3><ul>{report.decisions.slice(-7).reverse().map((day) => (
                  <li key={day.date}>{day.date} · {day.orders.length ? day.orders.map((order) => `${order.side === "buy" ? "买" : "卖"} ${order.symbol}`).join("、") : "空仓观察"}</li>
                ))}</ul></div>
                <div><h3>模拟成交</h3><ul>{report.fills.slice(-7).reverse().map((fill, index) => (
                  <li key={`${fill.date}-${fill.symbol}-${index}`}>{fill.date} · {fill.side === "buy" ? "买" : "卖"} {fill.symbol} {fill.shares} 股 @ {money(fill.price)}</li>
                ))}{report.fills.length === 0 && <li>尚无成交</li>}</ul></div>
              </div>
            </details>
          )}
          <p className="paper-disclaimer">仅为规则模拟，不存在 100% 确定的交易，也不是我逐股实时判断。</p>
          <details className="paper-method"><summary>规则与风险</summary><p>挂单须等次日开盘数据到齐才记为持仓；{report.method} 遇到美股休市、缺失或滞后的行情会暂停。</p></details>
        </>
      )}
    </section>
  );
}
