import { contrastRatio, meetsAA, relativeLuminance } from "../src/a11y/contrast";
import { darkColors, lightColors, textPairs } from "../src/theme/tokens";

describe("contrast helpers", () => {
  it("matches the WCAG reference values", () => {
    expect(relativeLuminance("#000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1);
    expect(contrastRatio("#000000", "#fff")).toBeCloseTo(21);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });

  it("applies the large-text threshold", () => {
    expect(meetsAA("#777777", "#FFFFFF")).toBe(false);
    expect(meetsAA("#777777", "#FFFFFF", true)).toBe(true);
  });

  it("rejects colours it can't measure", () => {
    expect(() => relativeLuminance("rgba(0,0,0,0.5)")).toThrow();
  });
});

describe.each([
  ["light", lightColors],
  ["dark", darkColors],
] as const)("%s theme", (_mode, colors) => {
  it.each(textPairs(colors).map((p) => [p.name, p] as const))("%s meets AA", (_name, pair) => {
    expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(pair.min);
  });
});
