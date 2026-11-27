// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => {
  cleanup();
});
import { BirthCertificateTool } from "./ui";

describe("birth certificate screen", () => {
  it("routes a birth jurisdiction and keeps a personal date off the official deadline", () => {
    render(<BirthCertificateTool asOf="2026-11-27" />);
    expect(
      screen.getByRole("heading", { name: "How do I replace a U.S. birth certificate?" }),
    ).toBeTruthy();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByLabelText(/social security|^ssn$/i)).toBeNull();

    fireEvent.change(screen.getByLabelText("Where was the birth registered?"), {
      target: { value: "oh" },
    });
    expect(screen.getByRole("link", { name: /official lookup for ohio/i }).getAttribute("href")).toBe(
      "https://www.cdc.gov/nchs/w2w/ohio.htm",
    );

    fireEvent.change(screen.getByLabelText("Where do you live now?"), {
      target: { value: "tx" },
    });
    expect(screen.getByText(/Texas does not issue this certificate/i)).toBeTruthy();
    expect(screen.getAllByLabelText(/Your target date \(not an official deadline\)/i)).toHaveLength(3);
  });

  it("names the New York City health department for a city birth", () => {
    render(<BirthCertificateTool asOf="2026-11-27" />);
    fireEvent.change(screen.getByLabelText("Where was the birth registered?"), {
      target: { value: "ny" },
    });
    fireEvent.click(screen.getByLabelText(/New York City \(Bronx, Brooklyn, Manhattan, Queens, or Staten Island\)/));
    expect(
      screen.getByRole("link", { name: "New York City Department of Health and Mental Hygiene" }).getAttribute("href"),
    ).toBe("https://www.nyc.gov/site/doh/services/birth-death-records-birth.page");
  });

  it("drops a reviewed office link after the review date", () => {
    render(<BirthCertificateTool asOf="2028-01-01" />);
    fireEvent.change(screen.getByLabelText("Where was the birth registered?"), {
      target: { value: "ny" },
    });
    fireEvent.click(screen.getByLabelText(/New York City \(Bronx, Brooklyn, Manhattan, Queens, or Staten Island\)/));
    const link = screen.getByRole("link", { name: /official lookup for new york city/i });
    expect(link.getAttribute("href")).toBe("https://www.cdc.gov/nchs/w2w/new_york_city.htm");
    expect(screen.queryByText("New York City Department of Health and Mental Hygiene")).toBeNull();
  });
});
