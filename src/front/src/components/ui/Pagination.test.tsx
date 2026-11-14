import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithPreferences } from "@/test/preferences";

import Pagination from "./Pagination";

describe("Pagination", () => {
  it("says which rows are shown", () => {
    renderWithPreferences(<Pagination offset={50} pageSize={50} total={142} onChange={() => undefined} />);

    expect(screen.getByText("51 à 100 sur 142")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  });

  it("shows nothing to count when there is no row", () => {
    renderWithPreferences(<Pagination offset={0} pageSize={50} total={0} onChange={() => undefined} />);

    expect(screen.getByText("0 à 0 sur 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();
  });

  it("asks for the offset of the page picked, the previous one and the next one", () => {
    const onChange = vi.fn();
    renderWithPreferences(<Pagination offset={50} pageSize={50} total={142} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Page précédente" }));
    fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));

    expect(onChange.mock.calls).toEqual([[100], [0], [100]]);
  });

  it("cannot go before the first page or after the last", () => {
    const first = renderWithPreferences(<Pagination offset={0} pageSize={50} total={142} onChange={() => undefined} />);
    expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();
    first.unmount();

    renderWithPreferences(<Pagination offset={100} pageSize={50} total={142} onChange={() => undefined} />);
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();
  });

  it("leaves a gap in a long list and blocks every button while a page loads", () => {
    renderWithPreferences(<Pagination offset={200} pageSize={10} total={500} onChange={() => undefined} busy />);

    expect(screen.getAllByText("…", { selector: "span" })).toHaveLength(2);
    for (const button of screen.getAllByRole("button")) {
      if (button.getAttribute("aria-current") !== "page") expect(button).toBeDisabled();
    }
  });
});
