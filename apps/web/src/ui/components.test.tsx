import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button, ChoiceGroup, Dialog, Field, ProgressBar, ProgressRing, Switch, TabPanel, Tabs, initialsOf } from "./components";

describe("Field", () => {
  it("links the label, hint and error to the control", () => {
    render(
      <Field label="Email" hint="We never share it." error="Check the address for typos." required>
        {(control) => <input {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAccessibleDescription("Check the address for typos. We never share it.");
  });

  it("is valid and only described by the hint without an error", () => {
    render(<Field label="Name" hint="What should we call you?">{(control) => <input {...control} />}</Field>);
    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("What should we call you?");
  });
});

describe("Button", () => {
  it("is disabled and busy while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults to type=button so it never submits forms by accident", () => {
    render(<Button>Hint</Button>);
    expect(screen.getByRole("button", { name: "Hint" })).toHaveAttribute("type", "button");
  });
});

describe("Switch", () => {
  function Harness({ onChange }: { onChange: (value: boolean) => void }) {
    const [on, setOn] = useState(false);
    return (
      <Switch
        label="Sound effects"
        description="Soft chimes"
        checked={on}
        onChange={(value) => {
          setOn(value);
          onChange(value);
        }}
      />
    );
  }

  it("toggles aria-checked and reports the new value", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Sound effects" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(toggle).toHaveAccessibleDescription("Soft chimes");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("progress visuals", () => {
  it("clamps ring values to 0–100", () => {
    const { rerender } = render(<ProgressRing value={1.7} label="Level 3" />);
    expect(screen.getByRole("progressbar", { name: "Level 3" })).toHaveAttribute("aria-valuenow", "100");
    rerender(<ProgressRing value={Number.NaN} label="Level 3" />);
    expect(screen.getByRole("progressbar", { name: "Level 3" })).toHaveAttribute("aria-valuenow", "0");
    rerender(<ProgressRing value={0.456} label="Level 3" />);
    expect(screen.getByRole("progressbar", { name: "Level 3" })).toHaveAttribute("aria-valuenow", "46");
  });

  it("shows a percentage label on progress bars when asked", () => {
    render(<ProgressBar value={0.25} label="Lesson progress" showLabel />);
    expect(screen.getByRole("progressbar", { name: "Lesson progress" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});

describe("Dialog", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Take a break?"
          description="Everything is saved."
          footer={
            <button type="button" onClick={() => setOpen(false)}>
              Keep practicing
            </button>
          }
        />
      </>
    );
  }

  it("moves focus in, traps Tab, closes on Escape and restores focus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);

    const dialog = await screen.findByRole("dialog", { name: "Take a break?" });
    expect(dialog).toHaveAccessibleDescription("Everything is saved.");
    const close = within(dialog).getByRole("button", { name: "Close dialog" });
    const keep = within(dialog).getByRole("button", { name: "Keep practicing" });
    await waitFor(() => expect(close).toHaveFocus());

    await user.tab();
    expect(keep).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(keep).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
});

describe("ChoiceGroup", () => {
  function Harness() {
    const [value, setValue] = useState<"5" | "10" | "15" | null>(null);
    return (
      <ChoiceGroup
        legend="Daily goal"
        name="goal"
        value={value}
        onChange={setValue}
        options={[
          { value: "5", label: "5 minutes" },
          { value: "10", label: "10 minutes" },
          { value: "15", label: "15 minutes" },
        ]}
      />
    );
  }

  it("is a labelled radio group that supports clicks and arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Daily goal" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);

    await user.click(screen.getByRole("radio", { name: /10 minutes/ }));
    expect(screen.getByRole("radio", { name: /10 minutes/ })).toBeChecked();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /15 minutes/ })).toBeChecked();
  });
});

describe("Tabs", () => {
  function Harness() {
    const [view, setView] = useState<"a" | "b" | "c">("a");
    return (
      <>
        <Tabs
          label="Views"
          idPrefix="t"
          value={view}
          onChange={setView}
          items={[
            { value: "a", label: "Overview" },
            { value: "b", label: "Heatmap" },
            { value: "c", label: "Students" },
          ]}
        />
        <TabPanel idPrefix="t" value={view}>
          Panel {view}
        </TabPanel>
      </>
    );
  }

  it("uses roving focus with arrows, Home and End", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const overview = screen.getByRole("tab", { name: "Overview" });
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Heatmap" })).toHaveAttribute("tabindex", "-1");

    await user.click(overview);
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Heatmap" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Heatmap" })).toHaveTextContent("Panel b");
    await waitFor(() => expect(screen.getByRole("tab", { name: "Heatmap" })).toHaveFocus());

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Students" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("initialsOf", () => {
  it("takes the first and last initials", () => {
    expect(initialsOf("Maya Santos")).toBe("MS");
    expect(initialsOf("  elena  maria rivera ")).toBe("ER");
    expect(initialsOf("Kai")).toBe("K");
    expect(initialsOf("")).toBe("?");
  });
});
