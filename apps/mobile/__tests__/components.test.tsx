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

