import type { ReactElement } from "react";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { asId, type ItemId, type PublicItem, type Response, type SkillId } from "@learnly/shared";
import { Button } from "../src/components/Button";
import { ItemView } from "../src/components/ItemView";
import { ProgressBar, ProgressRing } from "../src/components/Progress";
import { ThemeProvider } from "../src/theme/ThemeProvider";

function renderThemed(ui: ReactElement) {
  return render(<ThemeProvider forcedMode="light">{ui}</ThemeProvider>);
}

describe("Button", () => {
  it("calls onPress and exposes its label as an accessible button", () => {
    const onPress = jest.fn();
    renderThemed(<Button label="Start practice" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Start practice" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire while disabled and reports the disabled state", () => {
    const onPress = jest.fn();
    renderThemed(<Button label="Check my answer" onPress={onPress} disabled />);
    const button = screen.getByRole("button", { name: "Check my answer" });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: false });
  });

  it("marks itself busy and blocks presses while loading", () => {
    const onPress = jest.fn();
    renderThemed(<Button label="Signing in" onPress={onPress} loading />);
    const button = screen.getByRole("button", { name: "Signing in" });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });
});

describe("progress indicators", () => {
  it("reports ring progress as a 0-100 value", () => {
    renderThemed(<ProgressRing progress={0.42} accessibilityLabel="Daily goal" testID="ring" />);
    const ring = screen.getByTestId("ring");
    expect(ring.props.accessibilityRole).toBe("progressbar");
    expect(ring.props.accessibilityLabel).toBe("Daily goal");
    expect(ring.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 42 });
  });

  it("clamps out-of-range and invalid values", () => {
    renderThemed(
      <>
        <ProgressRing progress={1.8} accessibilityLabel="Over" testID="over" />
        <ProgressBar progress={Number.NaN} accessibilityLabel="Broken" testID="nan" />
      </>,
    );
    expect(screen.getByTestId("over").props.accessibilityValue.now).toBe(100);
    expect(screen.getByTestId("nan").props.accessibilityValue.now).toBe(0);
  });

  it("stays out of the accessibility tree when it has no label", () => {
    renderThemed(<ProgressBar progress={0.5} testID="bar" />);
    expect(screen.getByTestId("bar").props.accessible).toBe(false);
  });
});

const SKILL = asId<SkillId>("33333333-3333-4333-8333-333333333333");

const choiceItem: PublicItem = {
  id: asId<ItemId>("44444444-4444-4444-8444-444444444444"),
  skillId: SKILL,
  kind: "multiple_choice",
  prompt: "Which fraction is bigger?",
  difficulty: 0,
  hints: [],
  choices: [
    { id: "a", text: "2/5" },
    { id: "b", text: "3/5" },
  ],
};

const orderingItem: PublicItem = {
  id: asId<ItemId>("55555555-5555-4555-8555-555555555555"),
  skillId: SKILL,
  kind: "ordering",
  prompt: "Put the water cycle in order",
  difficulty: 0.3,
  hints: [],
  entries: [
    { id: "evap", text: "Evaporation" },
    { id: "cond", text: "Condensation" },
    { id: "prec", text: "Precipitation" },
  ],
};

function Controlled({ item, onValue }: { item: PublicItem; onValue: (r: Response | null) => void }) {
  const [value, setValue] = useState<Response | null>(null);
  return (
    <ItemView
      item={item}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

describe("ItemView", () => {
  it("selects a multiple choice answer and marks it checked", () => {
    const onValue = jest.fn();
    renderThemed(<Controlled item={choiceItem} onValue={onValue} />);
    const choice = screen.getByRole("radio", { name: "B. 3/5" });
    fireEvent.press(choice);
    expect(onValue).toHaveBeenLastCalledWith({ kind: "multiple_choice", choiceId: "b" });
    expect(screen.getByRole("radio", { name: "B. 3/5" }).props.accessibilityState).toMatchObject({ checked: true });
  });

  it("starts ordering items in their given order and moves one down via a screen reader action", () => {
    const onValue = jest.fn();
    renderThemed(<Controlled item={orderingItem} onValue={onValue} />);
    expect(onValue).toHaveBeenCalledWith({ kind: "ordering", order: ["evap", "cond", "prec"] });

    const first = screen.getByLabelText("Evaporation, position 1 of 3");
    fireEvent(first, "accessibilityAction", { nativeEvent: { actionName: "moveDown" } });

    expect(onValue).toHaveBeenLastCalledWith({ kind: "ordering", order: ["cond", "evap", "prec"] });
    expect(screen.getByLabelText("Evaporation, position 2 of 3")).toBeTruthy();
  });

  it("offers only the moves that make sense at each end of the list", () => {
    renderThemed(<Controlled item={orderingItem} onValue={jest.fn()} />);
    const first = screen.getByLabelText("Evaporation, position 1 of 3");
    const last = screen.getByLabelText("Precipitation, position 3 of 3");
    const names = (node: typeof first) =>
      (node.props.accessibilityActions as { name: string }[]).map((a) => a.name);
    expect(names(first)).toEqual(["moveDown"]);
    expect(names(last)).toEqual(["moveUp"]);
  });
});
