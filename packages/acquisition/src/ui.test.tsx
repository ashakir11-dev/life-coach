// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
  cleanup();
});
import { AcquisitionTool } from "./ui";

describe("acquisition comparison screen", () => {
  it("loads a guest sample and shows which path a down payment changes", () => {
    render(<AcquisitionTool asOf="2026-11-27" />);
    expect(
      screen.getByRole("heading", {
        name: "What would leasing, financing, or paying cash cost up front and each month?",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try a sample comparison" }));
    expect(screen.getByRole("cell", { name: "$790.97" })).toBeTruthy();
    expect(screen.getByText(/not a wealth comparison/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Down payment"), { target: { value: "3000.00" } });
    expect(screen.getByRole("cell", { name: "$760.55" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "$350.00" })).toBeTruthy();
    const status = screen.getByRole("status").textContent ?? "";
    expect(status).toMatch(/Finance down payment/);
    expect(status).toMatch(/Lease and Pay cash stayed the same/);
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
