import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AIStrategyPanel } from "../components/intelligence/AIStrategyPanel";

describe("AIStrategyPanel", () => {
  it("renders trigger button and opens Sheet like AnomalyPanel", () => {
    render(<AIStrategyPanel />);
    const button = screen.getByRole("button", { name: /Kentsel Strateji Brifingi/i });
    expect(button).toBeDefined();

    // Click button to open Sheet
    fireEvent.click(button);

    // Sheet should now be open with explicit AnomalyPanel-style cards
    expect(screen.getByText(/AI Kentsel Strateji Paneli/i)).toBeDefined();
    expect(screen.getByText(/1\. Genel Durum Özeti/i)).toBeDefined();
    expect(screen.getByText(/2\. Çapraz Stratejik Değerlendirme/i)).toBeDefined();
    expect(screen.getByText(/3\. Öncelikli İcra Direktifleri/i)).toBeDefined();
    expect(screen.getByText(/4\. 48 Saatlik Stratejik Öngörü/i)).toBeDefined();
  });
});
