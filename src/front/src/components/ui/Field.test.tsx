import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Field from "./Field";

describe("Field", () => {
  it("ties the label to the input", () => {
    render(<Field label="ICAO24" />);

    expect(screen.getByLabelText("ICAO24")).toBeInTheDocument();
  });

  it("passes the input attributes and events through", () => {
    const onChange = vi.fn();
    render(<Field label="Callsign" placeholder="AFR" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Callsign"), { target: { value: "AFR1" } });

    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.getByPlaceholderText("AFR")).toBeInTheDocument();
  });

  it("reads the hint with the field", () => {
    render(<Field label="ICAO24" hint="Up to six hexadecimal digits" />);

    expect(screen.getByLabelText("ICAO24")).toHaveAccessibleDescription("Up to six hexadecimal digits");
  });

  it("marks the field invalid and reads the error", () => {
    render(<Field label="ICAO24" hint="Hex" error="Not a valid address" />);

    const input = screen.getByLabelText("ICAO24");
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("Hex Not a valid address");
  });

  it("is valid and has no description by default", () => {
    render(<Field label="ICAO24" />);

    const input = screen.getByLabelText("ICAO24");
    expect(input).toBeValid();
    expect(input).not.toHaveAttribute("aria-describedby");
  });
});
