import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StaticStatusView } from "../components/StaticStatusView";

const manifestMock = vi.fn();
const site = {
  generated_at: 1791783593,
  bundle_built_at: 1791787200,
  snapshot_symbols: 5902,
  focus_count: 397,
  short_target: 75,
  prices: { symbols: 5300, max_date: "2026-10-09", typical_date: "2026-09-11", typical_symbols: 5000, fresh_symbols: 50 },
};
vi.mock("../data", () => ({
  manifest: () => manifestMock(),
}));

beforeEach(() => {
  manifestMock.mockReset();
  manifestMock.mockResolvedValue(site);
});

describe("StaticStatusView", () => {
  it("describes the hosted edition without claiming live SEC verification", async () => {
    render(<StaticStatusView pref="auto" onPref={() => {}} />);
    expect(await screen.findByText(/5,902 家美国交易所上市公司/)).toBeInTheDocument();
    expect(screen.getByText(/此静态版不提供实时 SEC 数值核验/)).toBeInTheDocument();
    expect(screen.getByText(/每日构建只会检查上游数据/)).toBeInTheDocument();
    expect(screen.getByText(/多数行情未覆盖预计交易日/)).toBeInTheDocument();
    expect(screen.getByText("网站重建")).toBeInTheDocument();
    expect(screen.getByText(/397 家按财报质量与行业分散选取/)).toBeInTheDocument();
    expect(screen.getByText(/最多 75 家/)).toBeInTheDocument();
    expect(screen.getByText(/缩小跟踪名单暂未减少上游下载量/)).toBeInTheDocument();
    expect(screen.queryByText(/服务端缓存 15 分钟/)).not.toBeInTheDocument();
  });

  it("shows an error and retries a failed manifest request", async () => {
    manifestMock.mockReset();
    manifestMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(site);
    render(<StaticStatusView pref="auto" onPref={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("数据清单暂不可用");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText(/5,902 家美国交易所上市公司/)).toBeInTheDocument();
  });
});
