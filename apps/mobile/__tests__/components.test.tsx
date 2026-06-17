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

