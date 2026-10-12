import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfficialDisclosure } from "../components/OfficialDisclosure";

const fetchOfficial = vi.fn();
vi.mock("../data/official-sec", () => ({ fetchOfficialCompany: (...args: unknown[]) => fetchOfficial(...args) }));

beforeEach(() => fetchOfficial.mockReset());

describe("SEC official disclosure", () => {
  it("shows filing dates, original link and a warning when structured facts lag", async () => {
    fetchOfficial.mockResolvedValue({
      status: "available", symbol: "CHT", cik: 1132924, name: "CHUNGHWA TELECOM CO LTD",
      checkedAt: "2026-10-12T04:00:00Z", factsAvailable: true,
      facts: [{ key: "revenue", label: "营业收入", value: 229968000000, unit: "TWD",
        periodEnd: "2024-12-31", filed: "2025-04-16", form: "20-F", url: "https://www.sec.gov/Archives/edgar/data/1132924/old/" }],
      filings: [{ form: "20-F", filed: "2026-04-10", reportDate: "2025-12-31", accession: "0001193125-26-155848",
        url: "https://www.sec.gov/Archives/edgar/data/1132924/new/" }],
    });
    render(<OfficialDisclosure symbol="CHT" />);
    expect(await screen.findByText(/结构化数值只到 2024-12-31/)).toBeInTheDocument();
    expect(screen.getByText(/营业收入 · 2024-12-31/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "20-F · 2026-04-10" })).toHaveAttribute("href", "https://www.sec.gov/Archives/edgar/data/1132924/new/");
    expect(screen.getByText(/快照，未据此自动重算/)).toBeInTheDocument();
  });

  it("does not call an unmatched ticker official data", async () => {
    fetchOfficial.mockResolvedValue({ status: "unmapped", symbol: "ZZZZ", checkedAt: "2026-10-12T04:00:00Z" });
    render(<OfficialDisclosure symbol="ZZZZ" />);
    expect(await screen.findByText(/未匹配到这只证券/)).toBeInTheDocument();
    expect(screen.queryByText(/官方数值只对应/)).not.toBeInTheDocument();
  });

  it("offers retry when the SEC service is unavailable", async () => {
    fetchOfficial.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ status: "unmapped", symbol: "CHT", checkedAt: "2026-10-12T04:00:00Z" });
    render(<OfficialDisclosure symbol="CHT" />);
    fireEvent.click(await screen.findByRole("button", { name: "重试" }));
    await waitFor(() => expect(fetchOfficial).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/未匹配到这只证券/)).toBeInTheDocument();
  });
});
