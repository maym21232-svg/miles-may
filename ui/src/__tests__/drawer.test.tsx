// FR-012 — drawer sizing: Expand toggles a persisted wide mode, the left
// separator resizes with the arrow keys (the keyboard path to the drag
// handle), and both survive a close/reopen. Pointer-capture drags are not
// exercised here — jsdom has no layout.

import { fireEvent, render, screen as rtl, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyDrawer } from "../components/CompanyDrawer";

const requestFetchMock = vi.fn(async (_symbol: string) => ({ queued: true }));
const companyMock = vi.fn(async () => ({
  profile: { name: "Acme", country: "FR", sector: "Tech" }, periods: [],
}));
vi.mock("../data", () => ({
  company: () => companyMock(),
  requestFetch: (symbol: string) => requestFetchMock(symbol),
  STATIC_MODE: false,
}));
vi.mock("../components/PriceChart", () => ({ PriceChart: () => null }));
vi.mock("../components/LiveQuote", () => ({ LiveQuote: () => null }));

beforeEach(() => {
  window.localStorage.clear();
  companyMock.mockReset().mockResolvedValue({
    profile: { name: "Acme", country: "FR", sector: "Tech" }, periods: [],
  });
});

describe("company loading", () => {
  it("offers a retry after a transient failure", async () => {
    companyMock.mockRejectedValueOnce(new Error("offline"));
    render(<CompanyDrawer symbol="ACME" onClose={() => {}} />);
    expect(await rtl.findByRole("alert")).toHaveTextContent("公司资料加载失败");
    fireEvent.click(rtl.getByRole("button", { name: "重试" }));
    expect(await rtl.findByText("Acme")).toBeInTheDocument();
    expect(companyMock).toHaveBeenCalledTimes(2);
  });
});

describe("drawer synthesis placement", () => {
  it("no synthesis without periods; with periods it precedes Statements", async () => {
    const { unmount } = render(<CompanyDrawer symbol="ACME" onClose={() => {}} />);
    await waitFor(() => expect(rtl.getByText("Acme")).toBeInTheDocument());
    // the mocked company has periods: [] — metadata only, no synthesis
    expect(rtl.queryByLabelText("Synthesis")).not.toBeInTheDocument();
    unmount();
  });
});

describe("on-demand fetch (FR-012)", () => {
  it("an uncrawled company offers 'Fetch now' and shows the queued state", async () => {
    const { unmount } = render(<CompanyDrawer symbol="ACME" onClose={() => {}} />);
    await waitFor(() => expect(rtl.getByText("Acme")).toBeInTheDocument());
    const button = rtl.getByRole("button", { name: /获取这家公司的资料/ });
    fireEvent.click(button);
    await waitFor(() => expect(rtl.getByRole("status")).toHaveTextContent(/已加入获取队列/));
    expect(requestFetchMock).toHaveBeenCalledWith("ACME");
    expect(rtl.queryByRole("button", { name: /获取这家公司的资料/ })).not.toBeInTheDocument();
    unmount();
  });
});

describe("drawer sizing", () => {
  it("Expand toggles a persisted wide mode that survives a reopen", async () => {
    const { unmount } = render(<CompanyDrawer symbol="ACME" onClose={() => {}} />);
    await waitFor(() => expect(rtl.getByText("Acme")).toBeInTheDocument());
    const dialog = rtl.getByRole("dialog");
    expect(dialog.style.getPropertyValue("--drawer-w")).toBe("560px");

    fireEvent.click(rtl.getByRole("button", { name: "展开" }));
    expect(dialog.style.getPropertyValue("--drawer-w")).toBe("min(1100px, 96vw)");
    expect(rtl.getByRole("button", { name: "收窄" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(window.localStorage.getItem("crible-drawer") ?? "{}")).toMatchObject({
      expanded: true,
    });

    unmount();
    render(<CompanyDrawer symbol="ACME" onClose={() => {}} />);
    await waitFor(() => expect(rtl.getByText("Acme")).toBeInTheDocument());
    expect(rtl.getByRole("button", { name: "收窄" })).toHaveAttribute("aria-pressed", "true");
  });

  it("arrow keys on the separator resize, persist, and leave expanded mode", async () => {
    render(<CompanyDrawer symbol="ACME" onClose={() => {}} />);
    await waitFor(() => expect(rtl.getByText("Acme")).toBeInTheDocument());
    const dialog = rtl.getByRole("dialog");
    const handle = rtl.getByRole("separator", { name: /调整详情宽度/ });

    fireEvent.keyDown(handle, { key: "ArrowLeft" }); // the drawer grows leftward
    expect(dialog.style.getPropertyValue("--drawer-w")).toBe("592px");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(dialog.style.getPropertyValue("--drawer-w")).toBe("560px");
    expect(JSON.parse(window.localStorage.getItem("crible-drawer") ?? "{}")).toMatchObject({
      width: 560,
      expanded: false,
    });
  });
});
