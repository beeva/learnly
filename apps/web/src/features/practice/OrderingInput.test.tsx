import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OrderingInput, type OrderingEntry } from "./OrderingInput";

const ENTRIES: OrderingEntry[] = [
  { id: "e1", text: "1/8" },
  { id: "e2", text: "1/4" },
  { id: "e3", text: "1/2" },
];

function Harness({ onChange, disabled }: { onChange?: (order: string[]) => void; disabled?: boolean }) {
  const [order, setOrder] = useState(ENTRIES.map((entry) => entry.id));
  return (
    <OrderingInput
      label="Order the fractions"
      entries={ENTRIES}
      order={order}
      disabled={disabled}
      onChange={(next) => {
        setOrder(next);
        onChange?.(next);
      }}
    />
  );
}

const row = (text: string) => screen.getByRole("listitem", { name: new RegExp(`^${text.replace("/", "\\/")}, position`) });

describe("OrderingInput", () => {
  it("labels each row with its position", () => {
    render(<Harness />);
    expect(screen.getByRole("listitem", { name: "1/8, position 1 of 3" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "1/2, position 3 of 3" })).toBeInTheDocument();
  });

  it("picks up, moves and drops an entry with the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    act(() => row("1/8").focus());
    await user.keyboard(" ");
    expect(screen.getByRole("status")).toHaveTextContent("Picked up 1/8. Position 1 of 3.");

    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith(["e2", "e1", "e3"]);
    expect(screen.getByRole("status")).toHaveTextContent("1/8 moved to position 2 of 3.");
    expect(screen.getByRole("listitem", { name: "1/8, position 2 of 3" })).toBeInTheDocument();

    act(() => row("1/8").focus());
    await user.keyboard(" ");
    expect(screen.getByRole("status")).toHaveTextContent("Dropped 1/8 at position 2 of 3.");
  });

  it("restores the original order when a move is cancelled with Escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    act(() => row("1/4").focus());
    await user.keyboard(" ");
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith(["e1", "e3", "e2"]);

    act(() => row("1/4").focus());
    await user.keyboard("{Escape}");
    expect(onChange).toHaveBeenLastCalledWith(["e1", "e2", "e3"]);
    expect(screen.getByRole("status")).toHaveTextContent("Move cancelled.");
  });

  it("only moves focus with arrows when nothing is picked up", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    act(() => row("1/8").focus());
    await user.keyboard("{ArrowDown}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reorders with the up and down buttons", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Move 1/8 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move 1/2 down" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Move 1/2 up" }));
    expect(onChange).toHaveBeenLastCalledWith(["e1", "e3", "e2"]);
  });

  it("ignores input while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} disabled />);

    expect(row("1/8")).toHaveAttribute("tabindex", "-1");
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();

    act(() => row("1/8").focus());
    await user.keyboard(" {ArrowDown}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
