import {
  asId,
  type Course,
  type GradeBand,
  type Item,
  type Lesson,
  type LessonBlock,
  type Skill,
  type Subject,
  type Unit,
} from "@learnly/shared";

/*
 * Seed curriculum for the mock API. Everything here is real teaching content so
 * the demo reads like the product: four courses, fourteen skills, a lesson per
 * skill and a calibrated bank of practice items across all four item kinds.
 */

/** Deterministic, schema-valid v4-shaped UUIDs: kind in the first group, n in the last. */
export function seedUuid(kind: number, n: number): string {
  return `${kind.toString(16).padStart(8, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

export const ID_KIND = { course: 1, unit: 2, skill: 3, lesson: 4, item: 5, user: 6, classroom: 7 } as const;

/* --------------------------------------------------------------- visuals */

function svgUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** A pizza-style fraction model with `shaded` of `parts` slices filled. */
export function pieImage(shaded: number, parts: number, hue = 248): string {
  const cx = 120;
  const cy = 120;
  const r = 96;
  const slices = Array.from({ length: parts }, (_, i) => {
    const a0 = (i / parts) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / parts) * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const fill = i < shaded ? `hsl(${hue} 70% 62%)` : "#fbfaf7";
    return `<path d="M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${fill}" stroke="#1c1b29" stroke-width="3" stroke-linejoin="round"/>`;
  }).join("");
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${slices}</svg>`);
}

/** Two fraction bars stacked to show equivalence (e.g. 1/2 and 2/4). */
export function barsImage(rows: { shaded: number; parts: number }[], hue = 248): string {
  const width = 420;
  const rowHeight = 56;
  const gap = 20;
  const body = rows
    .map((row, r) => {
      const y = 10 + r * (rowHeight + gap);
      const w = (width - 20) / row.parts;
      return Array.from(
        { length: row.parts },
        (_, i) =>
          `<rect x="${(10 + i * w).toFixed(2)}" y="${y}" width="${w.toFixed(2)}" height="${rowHeight}" rx="6" fill="${i < row.shaded ? `hsl(${hue + r * 40} 72% 64%)` : "#fbfaf7"}" stroke="#1c1b29" stroke-width="3"/>`,
      ).join("");
    })
    .join("");
  const height = 20 + rows.length * rowHeight + (rows.length - 1) * gap;
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>`);
}

/** A 0–1 number line split into `parts` jumps with one point highlighted. */
export function numberLineImage(parts: number, highlight: number): string {
  const x0 = 30;
  const x1 = 470;
  const y = 60;
  const ticks = Array.from({ length: parts + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / parts;
    const label = i === 0 ? "0" : i === parts ? "1" : `${i}/${parts}`;
    return `<line x1="${x}" y1="${y - 12}" x2="${x}" y2="${y + 12}" stroke="#1c1b29" stroke-width="3" stroke-linecap="round"/><text x="${x}" y="${y + 40}" font-family="Nunito, sans-serif" font-weight="800" font-size="18" text-anchor="middle" fill="#3d3c4f">${label}</text>`;
  }).join("");
  const hx = x0 + ((x1 - x0) * highlight) / parts;
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 110"><line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#1c1b29" stroke-width="4" stroke-linecap="round"/>${ticks}<circle cx="${hx}" cy="${y}" r="11" fill="#ff7a59" stroke="#1c1b29" stroke-width="3"/></svg>`,
  );
}

/** A left-to-right food chain diagram with labelled boxes and arrows. */
export function chainImage(labels: string[]): string {
  const boxW = 120;
  const gap = 46;
  const width = labels.length * boxW + (labels.length - 1) * gap + 20;
  const body = labels
    .map((label, i) => {
      const x = 10 + i * (boxW + gap);
      const arrow =
        i < labels.length - 1
          ? `<path d="M${x + boxW + 8} 50 h${gap - 18}" stroke="#1c1b29" stroke-width="3" stroke-linecap="round"/><path d="M${x + boxW + gap - 14} 42 l8 8 -8 8" fill="none" stroke="#1c1b29" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
          : "";
      return `<rect x="${x}" y="22" width="${boxW}" height="56" rx="14" fill="hsl(${140 - i * 30} 60% 78%)" stroke="#1c1b29" stroke-width="3"/><text x="${x + boxW / 2}" y="56" font-family="Nunito, sans-serif" font-weight="800" font-size="17" text-anchor="middle" fill="#1c1b29">${label}</text>${arrow}`;
    })
    .join("");
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 100">${body}</svg>`);
}

/* ---------------------------------------------------------------- seeds */

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type ItemSeed = DistributiveOmit<Item, "id" | "skillId">;
type BlockSeed = Exclude<LessonBlock, { kind: "check" }> | { kind: "check"; item: number };

interface LessonSeed {
  slug: string;
  title: string;
  level: Lesson["level"];
  estimatedMinutes: number;
  blocks: BlockSeed[];
}

interface SkillSeed {
  code: string;
  name: string;
  prerequisites?: string[];
  lesson: LessonSeed;
  items: ItemSeed[];
}

interface UnitSeed {
  title: string;
  summary: string;
  skills: SkillSeed[];
}

interface CourseSeed {
  slug: string;
  title: string;
  subject: Subject;
  gradeBand: GradeBand;
  description: string;
  coverHue: number;
  estimatedMinutes: number;
  units: UnitSeed[];
}

const mc = (prompt: string, choices: string[], answerIndex: number, difficulty: number, hints: string[], explanation: string): ItemSeed => ({
  kind: "multiple_choice",
  prompt,
  choices: choices.map((text, i) => ({ id: String.fromCharCode(97 + i), text })),
  answer: String.fromCharCode(97 + answerIndex),
  difficulty,
  hints,
  explanation,
});

const num = (prompt: string, answer: number, difficulty: number, hints: string[], explanation: string, unit?: string, tolerance = 0): ItemSeed => ({
  kind: "numeric",
  prompt,
  answer,
  tolerance,
  ...(unit ? { unit } : {}),
  difficulty,
  hints,
  explanation,
});

const text = (prompt: string, acceptedAnswers: string[], difficulty: number, hints: string[], explanation: string): ItemSeed => ({
  kind: "short_text",
  prompt,
  acceptedAnswers,
  difficulty,
  hints,
  explanation,
});

/** Ordering items list entries in the correct order; the API shuffles nothing, so we pre-shuffle by `display`. */
const order = (prompt: string, correct: string[], display: number[], difficulty: number, hints: string[], explanation: string): ItemSeed => {
  const entries = correct.map((entryText, i) => ({ id: `e${i + 1}`, text: entryText }));
  return {
    kind: "ordering",
    prompt,
    entries: display.map((index) => entries[index]!),
    answer: entries.map((entry) => entry.id),
    difficulty,
    hints,
    explanation,
  };
};

const COURSE_SEEDS: CourseSeed[] = [
  {
    slug: "fractions-foundations",
    title: "Fractions Foundations",
    subject: "math",
    gradeBand: "3-5",
    description:
      "From slicing pizzas to adding fractions: build a rock-solid sense of what fractions mean, how they compare and how they combine.",
    coverHue: 248,
    estimatedMinutes: 150,
    units: [
      {
        title: "What is a fraction?",
        summary: "Fractions name equal parts of a whole and points on the number line.",
        skills: [
          {
            code: "3.NF.1",
            name: "Parts of a whole",
            lesson: {
              slug: "numerators-and-denominators",
              title: "Slicing the pizza: numerators and denominators",
              level: 1,
              estimatedMinutes: 6,
              blocks: [
                { kind: "heading", text: "Equal parts" },
                {
                  kind: "paragraph",
                  text: "A fraction describes part of a whole that has been cut into equal pieces. The pieces must be the same size — otherwise sharing wouldn't be fair!",
                },
                { kind: "image", src: pieImage(3, 8), alt: "A pizza cut into 8 equal slices with 3 slices shaded.", caption: "3 of the 8 equal slices are shaded: 3/8." },
                { kind: "heading", text: "Two numbers, two jobs" },
                {
                  kind: "paragraph",
                  text: "The bottom number, the denominator, tells how many equal parts the whole is cut into. The top number, the numerator, tells how many of those parts we're talking about.",
                },
                { kind: "callout", tone: "remember", text: "Denominator = how many equal parts in all. Numerator = how many parts we have." },
                {
                  kind: "example",
                  prompt: "A sandwich is cut into 4 equal pieces. Jo eats 1 piece. What fraction of the sandwich did Jo eat?",
                  steps: ["Count all the equal pieces: there are 4. That's the denominator.", "Count the pieces Jo ate: 1. That's the numerator.", "Write the numerator over the denominator."],
                  answer: "Jo ate 1/4 of the sandwich.",
                },
                { kind: "check", item: 0 },
                { kind: "callout", tone: "try", text: "Look around you: a window with panes, a chocolate bar, a tiled floor. What fractions can you spot?" },
                { kind: "check", item: 1 },
              ],
            },
            items: [
              mc(
                "A pizza is cut into 8 equal slices. Maya eats 3 of them. What fraction of the pizza did she eat?",
                ["3/8", "3/5", "5/8", "8/3"],
                0,
                -1.2,
                ["The denominator counts all the equal slices.", "The numerator counts the slices Maya ate."],
                "There are 8 equal slices in all (denominator) and Maya ate 3 (numerator), so she ate 3/8.",
              ),
              num(
                "A chocolate bar has 6 equal pieces. How many pieces make up 1/2 of the bar?",
                3,
                -0.8,
                ["Half means splitting into 2 equal groups.", "Share 6 pieces into 2 equal groups."],
                "Half of 6 pieces is 6 ÷ 2 = 3 pieces.",
                "pieces",
              ),
              text(
                "In the fraction 5/9, what do we call the 9?",
                ["denominator", "the denominator"],
                -0.3,
                ["It's the bottom number.", "It names how many equal parts the whole has."],
                "The bottom number of a fraction is the denominator — it tells how many equal parts make the whole.",
              ),
              mc(
                "A square is split into 4 parts and 1 part is shaded. When does the shaded part show exactly 1/4?",
                ["Only when the 4 parts are the same size", "Whenever there are 4 parts", "Only when the shaded part is the biggest", "Only when the square is cut with diagonal lines"],
                0,
                0.4,
                ["Fractions are about equal parts.", "Would 1 out of 4 unequal parts be fair?"],
                "A fraction only works with equal parts. If the 4 parts are different sizes, the shaded part isn't 1/4 of the square.",
              ),
            ],
          },
          {
            code: "3.NF.2",
            name: "Fractions on a number line",
            prerequisites: ["3.NF.1"],
            lesson: {
              slug: "fractions-on-the-number-line",
              title: "Fractions live on the number line",
              level: 2,
              estimatedMinutes: 7,
              blocks: [
                {
                  kind: "paragraph",
                  text: "Fractions aren't just slices — they're numbers, so they have a place on the number line between whole numbers.",
                },
                { kind: "heading", text: "Jumps of equal size" },
                {
                  kind: "paragraph",
                  text: "Split the space from 0 to 1 into equal jumps. The denominator says how many jumps; the numerator says how many jumps you take from 0.",
                },
                { kind: "image", src: numberLineImage(4, 3), alt: "A number line from 0 to 1 split into 4 equal jumps, with a point at three fourths.", caption: "Three jumps of one fourth land on 3/4." },
                {
                  kind: "example",
                  prompt: "Where does 2/3 go on the number line?",
                  steps: ["Split 0 to 1 into 3 equal jumps (the denominator).", "Start at 0 and take 2 jumps (the numerator).", "Mark the point where you land."],
                  answer: "2/3 sits two-thirds of the way from 0 to 1 — closer to 1 than to 0.",
                },
                { kind: "callout", tone: "tip", text: "A fraction with the same numerator and denominator, like 4/4, lands exactly on 1." },
                { kind: "check", item: 0 },
                { kind: "check", item: 2 },
              ],
            },
            items: [
              num(
                "A number line from 0 to 1 is split into 5 equal jumps. How many jumps from 0 do you take to reach 3/5?",
                3,
                -0.6,
                ["The denominator tells how many jumps make 1.", "The numerator tells how many jumps to take."],
                "3/5 means 3 jumps of one fifth each, starting from 0.",
                "jumps",
              ),
              mc("Which fraction is closest to 1?", ["1/4", "2/3", "7/8", "1/2"], 2, 0.4, ["Think about how far each one is from a whole.", "7/8 is only 1/8 away from 1."], "7/8 is just one eighth away from 1, closer than 2/3 (one third away) or 1/2 (one half away)."),
              order(
                "Put these fractions in order from smallest to largest.",
                ["1/8", "1/4", "1/2", "3/4"],
                [2, 0, 3, 1],
                0.6,
                ["With a numerator of 1, more pieces means smaller pieces.", "3/4 is three of the 1/4 pieces."],
                "1/8 < 1/4 < 1/2 < 3/4. Smaller pieces (bigger denominators) make smaller unit fractions, and 3/4 is bigger than 1/2.",
              ),
              num("How many fourths make one whole?", 4, -1.1, ["Count jumps of 1/4 from 0 to 1."], "Four jumps of 1/4 reach 1, so 4/4 = 1.", "fourths"),
            ],
          },
        ],
      },
      {
        title: "Equivalent fractions",
        summary: "Different-looking fractions can name the very same amount.",
        skills: [
          {
            code: "4.NF.1",
            name: "Find equivalent fractions",
            prerequisites: ["3.NF.1", "3.NF.2"],
            lesson: {
              slug: "same-amount-different-names",
              title: "Same amount, different names",
              level: 2,
              estimatedMinutes: 8,
              blocks: [
                { kind: "heading", text: "Cutting pieces smaller" },
                {
                  kind: "paragraph",
                  text: "If you cut every piece of a half into two smaller pieces, you have twice as many pieces — but exactly the same amount of the whole.",
                },
                { kind: "image", src: barsImage([{ shaded: 1, parts: 2 }, { shaded: 2, parts: 4 }]), alt: "Two equal bars: the top shows 1 of 2 parts shaded, the bottom shows 2 of 4 parts shaded. The shaded lengths match.", caption: "1/2 and 2/4 cover the same length." },
                { kind: "callout", tone: "remember", text: "Multiply (or divide) the numerator and denominator by the same number and the fraction keeps its value." },
                {
                  kind: "example",
                  prompt: "Find a fraction equal to 2/3 with a denominator of 12.",
                  steps: ["Ask: what turns 3 into 12? Multiply by 4.", "Do the same to the numerator: 2 × 4 = 8.", "Check: 8/12 cuts each third into 4 smaller pieces."],
                  answer: "2/3 = 8/12",
                },
                { kind: "check", item: 0 },
                { kind: "check", item: 1 },
              ],
            },
            items: [
              mc("Which fraction is equal to 2/4?", ["1/3", "1/2", "3/4", "2/8"], 1, -0.4, ["Try dividing the top and bottom by the same number.", "2 ÷ 2 = 1 and 4 ÷ 2 = 2."], "Dividing the numerator and denominator by 2 gives 1/2, the same amount as 2/4."),
              num("Fill in the blank: 3/5 = ?/10", 6, 0, ["What turns 5 into 10?", "Multiply the numerator by 2 as well."], "5 × 2 = 10, so multiply the numerator by 2 too: 3 × 2 = 6. 3/5 = 6/10."),
              text("Write a fraction equal to 1/3 that has a denominator of 9.", ["3/9"], 0.5, ["What do you multiply 3 by to get 9?", "Multiply 1 by that same number."], "3 × 3 = 9, so 1 × 3 = 3. 1/3 = 3/9."),
              mc(
                "Sam says 2/3 = 3/4 because both are \"one piece less than a whole\". Is he right?",
                ["Yes, they are equal", "No — 2/3 = 8/12 but 3/4 = 9/12", "No — 3/4 is smaller than 2/3", "It depends on the size of the whole"],
                1,
                1.0,
                ["Rewrite both with the same denominator.", "Try twelfths."],
                "The missing pieces are different sizes (a third vs a fourth). In twelfths, 2/3 = 8/12 and 3/4 = 9/12, so 3/4 is a little bigger.",
              ),
            ],
          },
          {
            code: "4.NF.1b",
            name: "Simplify fractions",
            prerequisites: ["4.NF.1"],
            lesson: {
              slug: "simplest-form",
              title: "Simplest form: dividing by common factors",
              level: 3,
              estimatedMinutes: 8,
              blocks: [
                {
                  kind: "paragraph",
                  text: "A fraction is in simplest form when the numerator and denominator share no factor other than 1. Simplifying doesn't change the amount — it just uses the biggest pieces possible.",
                },
                {
                  kind: "example",
                  prompt: "Simplify 12/18.",
                  steps: ["List a common factor of 12 and 18. The greatest is 6.", "Divide the numerator: 12 ÷ 6 = 2.", "Divide the denominator: 18 ÷ 6 = 3.", "Check: 2 and 3 share no factor except 1."],
                  answer: "12/18 = 2/3",
                },
                { kind: "callout", tone: "tip", text: "Not sure of the greatest common factor? Divide by any common factor, then check again. You'll get there in a few steps." },
                { kind: "check", item: 0 },
                { kind: "check", item: 3 },
              ],
            },
            items: [
              num("Simplify 6/8. What is the numerator of the simplified fraction?", 3, 0.2, ["6 and 8 are both even.", "Divide both by 2."], "6 ÷ 2 = 3 and 8 ÷ 2 = 4, so 6/8 = 3/4."),
              text("Write 10/15 in simplest form.", ["2/3"], 0.6, ["10 and 15 are both in the 5 times table.", "Divide both by 5."], "10 ÷ 5 = 2 and 15 ÷ 5 = 3, so 10/15 = 2/3."),
              mc("Which fraction is already in simplest form?", ["4/6", "5/10", "7/9", "9/12"], 2, 0.4, ["Look for a number that divides both parts.", "7 is prime and 9 isn't a multiple of 7."], "7 and 9 share no factor except 1. The others can all be divided further (by 2, 5 and 3)."),
              order(
                "Put the steps for simplifying 12/18 in order.",
                ["Find the greatest common factor of 12 and 18 (it's 6)", "Divide the numerator by 6 to get 2", "Divide the denominator by 6 to get 3", "Check that 2 and 3 share no factor but 1"],
                [2, 0, 3, 1],
                0.8,
                ["You need the factor before you can divide.", "Checking comes last."],
                "Find the common factor, divide the numerator and denominator by it, then check the result can't be simplified further.",
              ),
            ],
          },
        ],
      },
      {
        title: "Comparing & adding",
        summary: "Decide which fraction is greater and combine like-sized pieces.",
        skills: [
          {
            code: "4.NF.2",
            name: "Compare fractions",
            prerequisites: ["4.NF.1"],
            lesson: {
              slug: "comparing-fractions",
              title: "Which is bigger? Comparing fractions",
              level: 3,
              estimatedMinutes: 7,
              blocks: [
                { kind: "heading", text: "Same numerator? Look at the piece size" },
                { kind: "paragraph", text: "3/5 and 3/8 both have 3 pieces. Fifths are bigger than eighths, so 3/5 is greater." },
                { kind: "image", src: barsImage([{ shaded: 3, parts: 5 }, { shaded: 3, parts: 8 }], 20), alt: "Two equal bars: 3 of 5 parts shaded is longer than 3 of 8 parts shaded.", caption: "Same number of pieces — but fifths are bigger." },
                { kind: "heading", text: "Different everything? Find a common denominator" },
                {
                  kind: "example",
                  prompt: "Compare 2/3 and 3/4.",
                  steps: ["Rewrite both in twelfths: 2/3 = 8/12.", "3/4 = 9/12.", "Compare the numerators: 8 < 9."],
                  answer: "2/3 < 3/4",
                },
                { kind: "callout", tone: "remember", text: "A bigger denominator means smaller pieces, not a bigger fraction." },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              mc("Which is greater: 3/8 or 3/5?", ["3/8", "3/5", "They are equal"], 1, 0.3, ["Both have 3 pieces. Which pieces are bigger?", "Fifths are bigger than eighths."], "With the same numerator, the fraction with bigger pieces (smaller denominator) is greater: 3/5 > 3/8."),
              mc("Which symbol makes this true? 2/3 ☐ 4/6", ["<", ">", "="], 2, 0.1, ["Double the numerator and denominator of 2/3.", "Is 4/6 the same as 2/3 doubled?"], "2/3 = 4/6 because multiplying the top and bottom by 2 keeps the value the same."),
              order(
                "Order these fractions from smallest to largest.",
                ["1/6", "5/12", "2/3", "3/4"],
                [2, 3, 0, 1],
                1.2,
                ["Rewrite them all as twelfths.", "1/6 = 2/12, 2/3 = 8/12, 3/4 = 9/12."],
                "In twelfths they are 2/12, 5/12, 8/12 and 9/12, so 1/6 < 5/12 < 2/3 < 3/4.",
              ),
              num("Lena ran 3/4 of a mile and Theo ran 5/8 of a mile. How many eighths of a mile farther did Lena run?", 1, 1.1, ["Rewrite 3/4 in eighths.", "3/4 = 6/8."], "3/4 = 6/8, and 6/8 − 5/8 = 1/8. Lena ran 1 eighth of a mile farther.", "eighths"),
            ],
          },
          {
            code: "4.NF.3",
            name: "Add fractions with like denominators",
            prerequisites: ["4.NF.1"],
            lesson: {
              slug: "adding-like-fractions",
              title: "Adding fractions: same-size pieces",
              level: 3,
              estimatedMinutes: 8,
              blocks: [
                { kind: "paragraph", text: "When fractions have the same denominator, the pieces are the same size, so you can count them up just like apples." },
                { kind: "image", src: pieImage(3, 4, 150), alt: "A circle cut into 4 equal parts with 3 parts shaded.", caption: "1/4 + 2/4 = 3/4 — three of the same-size pieces." },
                { kind: "callout", tone: "remember", text: "Add the numerators. Keep the denominator — the size of the pieces doesn't change." },
                {
                  kind: "example",
                  prompt: "Find 2/7 + 3/7.",
                  steps: ["Check the denominators match: both are sevenths.", "Add the numerators: 2 + 3 = 5.", "Keep the denominator: sevenths."],
                  answer: "2/7 + 3/7 = 5/7",
                },
                {
                  kind: "callout",
                  tone: "tip",
                  text: "Watch out for adding the denominators too. 1/4 + 1/4 isn't 2/8 — two quarters of a pizza is half the pizza, and 2/8 is only a quarter!",
                },
                { kind: "check", item: 0 },
                { kind: "check", item: 2 },
              ],
            },
            items: [
              text("1/4 + 2/4 = ?", ["3/4"], -0.5, ["The pieces are all fourths.", "Count the fourths: 1 + 2."], "Both are fourths, so add the numerators: 1 + 2 = 3. The answer is 3/4."),
              num("2/7 + 3/7 = ?/7", 5, -0.6, ["Add the top numbers.", "The pieces stay sevenths."], "Add the numerators: 2 + 3 = 5, so the sum is 5/7."),
              mc("What is 3/8 + 3/8?", ["6/16", "6/8", "3/8", "9/8"], 1, 0.2, ["Are the pieces the same size?", "Add the numerators only."], "Eighths plus eighths are still eighths: 3 + 3 = 6, so 6/8 (which simplifies to 3/4). Adding the denominators would make the pieces smaller, which can't happen."),
              num("Ava read 2/5 of a book on Monday and 2/5 on Tuesday. How many fifths of the book has she read?", 4, -0.1, ["Add the fifths together."], "2/5 + 2/5 = 4/5, so she has read 4 fifths.", "fifths"),
              text("5/6 − 1/6 = ? Write your answer in simplest form.", ["2/3"], 0.9, ["Subtract the numerators: 5 − 1.", "Can 4/6 be simplified?"], "5/6 − 1/6 = 4/6, and dividing both parts by 2 gives 2/3."),
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "algebra-readiness",
    title: "Algebra Readiness",
    subject: "math",
    gradeBand: "6-8",
    description: "Get comfortable with expressions and equations. Learn to follow the order of operations, substitute values and solve for the unknown.",
    coverHue: 14,
    estimatedMinutes: 120,
    units: [
      {
        title: "Expressions",
        summary: "Read, build and evaluate expressions with confidence.",
        skills: [
          {
            code: "6.EE.1",
            name: "Order of operations",
            lesson: {
              slug: "order-of-operations",
              title: "Order of operations without the panic",
              level: 2,
              estimatedMinutes: 7,
              blocks: [
                { kind: "paragraph", text: "Without an agreed order, 3 + 4 × 2 could be 14 or 11. Mathematicians agreed: multiply and divide before you add and subtract." },
                { kind: "callout", tone: "remember", text: "Parentheses → exponents → multiply & divide (left to right) → add & subtract (left to right)." },
                {
                  kind: "example",
                  prompt: "Evaluate 18 ÷ (2 + 1) × 2.",
                  steps: ["Parentheses first: 2 + 1 = 3.", "Divide and multiply from left to right: 18 ÷ 3 = 6.", "Then 6 × 2 = 12."],
                  answer: "12",
                },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              num("Evaluate 3 + 4 × 2.", 11, -0.5, ["Multiply before adding.", "4 × 2 = 8."], "Multiplication comes first: 4 × 2 = 8, then 3 + 8 = 11."),
              num("Evaluate (8 − 2) × 3 − 4.", 14, 0.2, ["Start inside the parentheses.", "6 × 3 = 18."], "(8 − 2) = 6, then 6 × 3 = 18, then 18 − 4 = 14."),
              order(
                "Put the steps for evaluating 18 ÷ (2 + 1) × 2 in order.",
                ["Add inside the parentheses: 2 + 1 = 3", "Divide: 18 ÷ 3 = 6", "Multiply: 6 × 2 = 12"],
                [1, 2, 0],
                0.5,
                ["Parentheses always go first.", "Division and multiplication go left to right."],
                "Parentheses first, then division and multiplication from left to right.",
              ),
              mc("Which expression equals 20?", ["2 + 3 × 4", "(2 + 3) × 4", "2 × 3 + 4", "24 ÷ 2 + 3"], 1, 0.3, ["Evaluate each one carefully.", "Parentheses change what happens first."], "(2 + 3) × 4 = 5 × 4 = 20. Without parentheses, 2 + 3 × 4 = 14."),
            ],
          },
          {
            code: "6.EE.2c",
            name: "Evaluate expressions",
            prerequisites: ["6.EE.1"],
            lesson: {
              slug: "substitution",
              title: "Substitution: putting numbers in for letters",
              level: 2,
              estimatedMinutes: 6,
              blocks: [
                { kind: "paragraph", text: "A variable is a placeholder. To evaluate an expression, swap each variable for its value, then follow the order of operations." },
                {
                  kind: "example",
                  prompt: "Evaluate 4x + 3 when x = 5.",
                  steps: ["Replace x with 5: 4 × 5 + 3.", "Multiply: 4 × 5 = 20.", "Add: 20 + 3 = 23."],
                  answer: "23",
                },
                { kind: "callout", tone: "tip", text: "Writing the multiplication sign out (4 × 5) helps you avoid reading 4x as 45." },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              num("Evaluate 4x + 3 when x = 5.", 23, -0.3, ["Replace x with 5.", "4 × 5 = 20."], "4 × 5 + 3 = 20 + 3 = 23."),
              num("Evaluate a² − 2a when a = 6.", 24, 0.8, ["a² means a × a.", "36 − 12."], "6² − 2 × 6 = 36 − 12 = 24."),
              mc("If n = 3, what is 2(n + 4)?", ["10", "14", "11", "24"], 1, 0.4, ["Work inside the parentheses first.", "3 + 4 = 7."], "n + 4 = 7, and 2 × 7 = 14."),
            ],
          },
        ],
      },
      {
        title: "Equations",
        summary: "Use inverse operations to find the unknown.",
        skills: [
          {
            code: "6.EE.7",
            name: "One-step equations",
            prerequisites: ["6.EE.2c"],
            lesson: {
              slug: "one-step-equations",
              title: "Undo it: one-step equations",
              level: 3,
              estimatedMinutes: 7,
              blocks: [
                { kind: "paragraph", text: "An equation is a balance. Whatever you do to one side, do to the other, and it stays balanced." },
                { kind: "callout", tone: "remember", text: "Use the inverse operation: subtraction undoes addition, division undoes multiplication." },
                {
                  kind: "example",
                  prompt: "Solve 4y = 36.",
                  steps: ["y is being multiplied by 4.", "Undo it: divide both sides by 4.", "36 ÷ 4 = 9."],
                  answer: "y = 9",
                },
                { kind: "check", item: 1 },
              ],
            },
            items: [
              num("Solve x + 9 = 17. What is x?", 8, -0.6, ["What undoes adding 9?", "Subtract 9 from both sides."], "x + 9 − 9 = 17 − 9, so x = 8."),
              num("Solve 4y = 36. What is y?", 9, -0.2, ["y is multiplied by 4.", "Divide both sides by 4."], "36 ÷ 4 = 9, so y = 9."),
              num("Solve n ÷ 3 = 7. What is n?", 21, 0.3, ["What undoes dividing by 3?", "Multiply both sides by 3."], "Multiply both sides by 3: n = 21."),
              mc("Which step solves m − 12 = 30?", ["Subtract 12 from both sides", "Add 12 to both sides", "Divide both sides by 12", "Multiply both sides by 12"], 1, 0.1, ["What is happening to m?", "The inverse of subtracting 12 is adding 12."], "Adding 12 to both sides undoes the subtraction: m = 42."),
            ],
          },
          {
            code: "7.EE.4",
            name: "Two-step equations",
            prerequisites: ["6.EE.7"],
            lesson: {
              slug: "two-step-equations",
              title: "Two steps to solve",
              level: 4,
              estimatedMinutes: 9,
              blocks: [
                { kind: "paragraph", text: "Two-step equations wrap the variable in two operations. Unwrap them in reverse order — like taking off socks after shoes." },
                {
                  kind: "example",
                  prompt: "Solve 2x + 5 = 19.",
                  steps: ["Undo the addition first: subtract 5 from both sides → 2x = 14.", "Undo the multiplication: divide both sides by 2.", "x = 7. Check: 2 × 7 + 5 = 19 ✓."],
                  answer: "x = 7",
                },
                { kind: "callout", tone: "try", text: "Always plug your answer back in. If both sides match, you're right — no answer key needed." },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              num("Solve 2x + 5 = 19. What is x?", 7, 0.3, ["Subtract 5 from both sides first.", "Then divide by 2."], "2x = 14, so x = 7."),
              num("Solve 3m − 4 = 20. What is m?", 8, 0.6, ["Add 4 to both sides.", "Then divide by 3."], "3m = 24, so m = 8."),
              order(
                "Put the steps for solving 5x − 3 = 22 in order.",
                ["Add 3 to both sides: 5x = 25", "Divide both sides by 5: x = 5", "Check: 5 × 5 − 3 = 22"],
                [2, 0, 1],
                0.9,
                ["Undo the subtraction before the multiplication."],
                "Undo operations in reverse: add 3, divide by 5, then check by substituting.",
              ),
              num("Solve (k ÷ 4) + 6 = 11. What is k?", 20, 1.3, ["Subtract 6 first.", "Then multiply by 4."], "k ÷ 4 = 5, so k = 20."),
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "reading-detectives",
    title: "Reading Detectives",
    subject: "reading",
    gradeBand: "3-5",
    description: "Become a reading detective: find the big idea, track down supporting details, read between the lines and crack unfamiliar words.",
    coverHue: 162,
    estimatedMinutes: 110,
    units: [
      {
        title: "Big ideas",
        summary: "What is this text mostly about, and how do we know?",
        skills: [
          {
            code: "RI.3.2",
            name: "Main idea",
            lesson: {
              slug: "finding-the-main-idea",
              title: "Finding the main idea",
              level: 1,
              estimatedMinutes: 6,
              blocks: [
                { kind: "paragraph", text: "The main idea is what a paragraph is mostly about. It's the umbrella that all the other sentences fit under." },
                { kind: "callout", tone: "tip", text: "Ask: if I had to explain this paragraph in one sentence, what would I say?" },
                {
                  kind: "example",
                  prompt: "Bees visit flowers to drink nectar. As they move, pollen sticks to their fuzzy bodies and rubs off on the next flower. This helps plants make seeds. Without bees, many fruits would not grow. What is the main idea?",
                  steps: ["List what each sentence talks about: nectar, pollen, seeds, fruit.", "Find what they have in common: bees helping plants.", "Put it in one sentence."],
                  answer: "Bees help plants make seeds and fruit by carrying pollen.",
                },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              mc(
                "\"Sea otters hold hands while they sleep so they don't drift apart. They also wrap themselves in seaweed to stay in place. Mother otters float their babies on their bellies.\" What is the main idea?",
                ["Sea otters eat seaweed", "Sea otters have clever ways to stay safe and together in the water", "Baby otters can't swim", "Otters sleep all day"],
                1,
                -0.4,
                ["What do all three sentences have in common?", "Holding hands, wrapping in seaweed, floating babies…"],
                "Every sentence describes a way otters stay safe and together in the water.",
              ),
              mc(
                "\"The Sahara is the largest hot desert. It gets very little rain. Some years, parts of it get none at all. Days are scorching, but nights can be freezing.\" Which title fits best?",
                ["Rainy Days", "Life in the Sahara's Harsh Weather", "Camels Are Great", "The Coldest Place on Earth"],
                1,
                0.1,
                ["The title should cover every sentence.", "Rain, heat and cold are all weather."],
                "Every sentence describes the Sahara's extreme weather.",
              ),
              text(
                "In one or two words, what is this paragraph mostly about? \"Volcanoes form when melted rock pushes up through Earth's crust. When pressure builds, they erupt, sending out lava, ash and gas.\"",
                ["volcanoes", "volcano", "how volcanoes form", "volcano eruptions", "volcanoes erupting"],
                0.3,
                ["What is the topic of both sentences?"],
                "Both sentences explain volcanoes — how they form and erupt.",
              ),
            ],
          },
          {
            code: "RI.3.8",
            name: "Supporting details",
            prerequisites: ["RI.3.2"],
            lesson: {
              slug: "supporting-details",
              title: "Details that hold up the big idea",
              level: 2,
              estimatedMinutes: 6,
              blocks: [
                { kind: "paragraph", text: "Supporting details are facts, examples and reasons that prove the main idea. If the main idea is a table top, details are the legs." },
                { kind: "callout", tone: "remember", text: "A detail supports the main idea only if it helps explain or prove it." },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              mc(
                "Main idea: \"Exercise is good for your brain.\" Which detail supports it?",
                ["Running shoes come in many colors", "Exercise sends more oxygen to the brain, helping you focus", "Some people exercise in the morning", "Soccer is popular around the world"],
                1,
                -0.3,
                ["Which choice explains why exercise helps the brain?"],
                "Only the oxygen detail explains how exercise helps the brain.",
              ),
              mc(
                "Main idea: \"Penguins are well built for cold water.\" Which detail does NOT support it?",
                ["Thick fat keeps them warm", "Tightly packed feathers keep water out", "Penguins live only in the Southern Hemisphere", "Their wings work like flippers"],
                2,
                0.5,
                ["Three details are about bodies built for cold water.", "Which one is about where penguins live instead?"],
                "Where penguins live is true, but it doesn't explain how their bodies handle cold water.",
              ),
              order(
                "Put this paragraph in a logical order: main idea first, then details.",
                ["Recycling helps our planet.", "It saves trees by reusing paper.", "It keeps plastic out of the ocean.", "So, recycling is a small habit with a big impact."],
                [2, 0, 3, 1],
                0.7,
                ["Main idea first, conclusion last."],
                "Start with the main idea, give supporting details, then wrap up.",
              ),
            ],
          },
        ],
      },
      {
        title: "Reading between the lines",
        summary: "Use clues from the text plus what you know.",
        skills: [
          {
            code: "RL.4.1",
            name: "Making inferences",
            prerequisites: ["RI.3.2"],
            lesson: {
              slug: "making-inferences",
              title: "Clues + what you know = inference",
              level: 3,
              estimatedMinutes: 7,
              blocks: [
                { kind: "paragraph", text: "Authors don't tell us everything. An inference is a smart guess that combines clues in the text with what you already know." },
                {
                  kind: "example",
                  prompt: "\"Marco grabbed his umbrella and pulled on his rain boots before heading to the bus stop.\" What can you infer?",
                  steps: ["Clue: umbrella and rain boots.", "What I know: people use these when it's wet.", "Combine them."],
                  answer: "It is probably raining, or about to rain.",
                },
                { kind: "callout", tone: "try", text: "After every inference, point to the clue that proves it." },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              mc(
                "\"Priya's hands shook as she stepped onto the stage. She took a deep breath and looked at the crowd.\" How is Priya probably feeling?",
                ["Bored", "Nervous", "Angry", "Sleepy"],
                1,
                -0.5,
                ["Look at what her body is doing.", "Shaking hands and deep breaths…"],
                "Shaking hands and a deep breath before facing a crowd are clues that she feels nervous.",
              ),
              mc(
                "\"When Dad opened the door, mud was tracked across the kitchen and the dog's leash was missing from its hook.\" What most likely happened?",
                ["Dad cleaned the kitchen", "Someone took the dog for a walk and came back muddy", "The dog learned to open doors", "It snowed overnight"],
                1,
                0.4,
                ["What two clues are in the sentence?", "Mud + missing leash."],
                "The missing leash and the muddy footprints suggest someone walked the dog in the mud.",
              ),
              text(
                "\"The leaves crunched under Leo's feet and he zipped his jacket up to his chin.\" What season is it most likely?",
                ["fall", "autumn"],
                0.6,
                ["Crunchy leaves on the ground…", "Getting chilly, but not snowy."],
                "Fallen, crunchy leaves and cool air are clues that it's fall (autumn).",
              ),
            ],
          },
          {
            code: "RL.4.4",
            name: "Context clues",
            prerequisites: ["RI.3.8"],
            lesson: {
              slug: "context-clues",
              title: "Cracking new words with context clues",
              level: 2,
              estimatedMinutes: 6,
              blocks: [
                { kind: "paragraph", text: "When you meet a new word, the sentences around it often hide its meaning. Look for definitions, examples, synonyms or opposites nearby." },
                {
                  kind: "example",
                  prompt: "\"The hikers were famished after the long climb, so they ate every bite of their lunch.\" What does famished mean?",
                  steps: ["Find the clue: they ate every bite after a long climb.", "Think: why would someone eat everything?", "Test the meaning in the sentence."],
                  answer: "Famished means very hungry.",
                },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              mc("\"The ancient castle was over a thousand years old.\" What does ancient mean?", ["Very old", "Very big", "Brand new", "Haunted"], 0, -0.6, ["Look at the clue after the word."], "\"Over a thousand years old\" tells us ancient means very old."),
              mc(
                "\"Unlike his gregarious sister, who loved parties, Omar preferred quiet time alone.\" What does gregarious mean?",
                ["Shy", "Sociable and outgoing", "Grumpy", "Sleepy"],
                1,
                0.7,
                ["\"Unlike\" signals an opposite.", "Omar likes quiet; his sister loves parties."],
                "\"Unlike\" contrasts the sister with quiet Omar, so gregarious means sociable and outgoing.",
              ),
              text(
                "\"The glass was so fragile that it shattered when I barely touched it.\" Write a word that means the same as fragile.",
                ["delicate", "breakable", "easily broken", "weak", "flimsy"],
                0.3,
                ["What happened when it was barely touched?"],
                "Something that shatters at a light touch is fragile — delicate or easily broken.",
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "ecosystems-explorer",
    title: "Ecosystems Explorer",
    subject: "science",
    gradeBand: "6-8",
    description: "Follow the flow of energy from sunlight to top predators, and discover how every living thing depends on the others around it.",
    coverHue: 128,
    estimatedMinutes: 90,
    units: [
      {
        title: "Energy in ecosystems",
        summary: "Who makes food, who eats whom, and where the energy goes.",
        skills: [
          {
            code: "MS-LS2-3a",
            name: "Producers and consumers",
            lesson: {
              slug: "producers-and-consumers",
              title: "Producers, consumers and decomposers",
              level: 1,
              estimatedMinutes: 6,
              blocks: [
                { kind: "paragraph", text: "Producers, like plants and algae, make their own food from sunlight through photosynthesis. Consumers get energy by eating other living things." },
                { kind: "callout", tone: "remember", text: "Herbivores eat producers, carnivores eat other consumers, omnivores eat both — and decomposers recycle what's left." },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              mc("Which of these is a producer?", ["Rabbit", "Oak tree", "Mushroom", "Hawk"], 1, -1.0, ["Producers make their own food.", "Which one uses sunlight?"], "An oak tree makes its own food through photosynthesis. Mushrooms are decomposers."),
              mc("A bear eats berries and fish. What kind of consumer is it?", ["Herbivore", "Carnivore", "Omnivore", "Producer"], 2, -0.2, ["Berries are plants; fish are animals."], "An animal that eats both plants and animals is an omnivore."),
              text("What is the name of the process plants use to turn sunlight into food?", ["photosynthesis"], 0.2, ["It starts with \"photo\", meaning light."], "Photosynthesis uses light energy, water and carbon dioxide to make sugar."),
            ],
          },
          {
            code: "MS-LS2-3b",
            name: "Food chains and webs",
            prerequisites: ["MS-LS2-3a"],
            lesson: {
              slug: "food-chains",
              title: "Following energy through a food chain",
              level: 2,
              estimatedMinutes: 7,
              blocks: [
                { kind: "paragraph", text: "A food chain shows who eats whom. The arrows point in the direction the energy flows — from the food to the eater." },
                { kind: "image", src: chainImage(["Grass", "Grasshopper", "Frog", "Snake"]), alt: "A food chain: grass to grasshopper to frog to snake, with arrows showing energy flow.", caption: "Energy flows from grass all the way to the snake." },
                { kind: "callout", tone: "tip", text: "Read arrows as \"is eaten by\": grass is eaten by the grasshopper." },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              order("Put this food chain in order, starting with the producer.", ["Algae", "Small fish", "Large fish", "Osprey"], [3, 1, 0, 2], 0.0, ["Start with the organism that makes its own food."], "Algae (producer) → small fish → large fish → osprey."),
              mc("In a food chain, which way do the arrows point?", ["From the eater to the food", "From the food to the eater", "From the biggest animal to the smallest", "It doesn't matter"], 1, 0.3, ["Arrows show where energy goes."], "Arrows follow energy, which flows from the food into the organism that eats it."),
              mc("If all the frogs disappeared from a pond, what would most likely happen to the insects they eat?", ["Insects would decrease", "Insects would increase", "Nothing would change", "Insects would become producers"], 1, 0.8, ["Frogs are predators of the insects."], "With fewer predators eating them, insect populations would likely grow."),
            ],
          },
        ],
      },
      {
        title: "Balance and change",
        summary: "Why there are fewer top predators than plants.",
        skills: [
          {
            code: "MS-LS2-3c",
            name: "Energy pyramids",
            prerequisites: ["MS-LS2-3b"],
            lesson: {
              slug: "energy-pyramids",
              title: "The 10% rule and energy pyramids",
              level: 3,
              estimatedMinutes: 8,
              blocks: [
                { kind: "paragraph", text: "Only about 10% of the energy at one level of a food chain is passed to the next. The rest is used for living — moving, growing, staying warm — or lost as heat." },
                {
                  kind: "example",
                  prompt: "Grass stores 10,000 units of energy. How much reaches a snake three levels up (grass → grasshopper → frog → snake)?",
                  steps: ["Grasshoppers get 10%: 1,000 units.", "Frogs get 10% of that: 100 units.", "Snakes get 10% of that: 10 units."],
                  answer: "About 10 units of energy reach the snake.",
                },
                { kind: "callout", tone: "remember", text: "That's why ecosystems have many more plants than top predators." },
                { kind: "check", item: 0 },
              ],
            },
            items: [
              num("Plants in a meadow store 5,000 units of energy. About how many units pass to the rabbits that eat them?", 500, 0.2, ["Use the 10% rule.", "10% of 5,000."], "10% of 5,000 is 500 units.", "units", 0),
              num("If hawks receive 6 units of energy, about how many units were in the snakes they ate?", 60, 0.9, ["Work backwards.", "Hawks got 10% of the snakes' energy."], "6 is 10% of 60, so the snakes had about 60 units.", "units", 0),
              mc("Why are there usually fewer top predators than plants?", ["Predators are bigger", "Energy is lost at each level, so less is available higher up", "Plants grow faster than animals", "Predators don't need energy"], 1, 0.5, ["Think about the 10% rule."], "Only about 10% of energy moves up each level, so higher levels can support fewer organisms."),
            ],
          },
        ],
      },
    ],
  },
];

/* --------------------------------------------------------------- catalog */

export interface CourseRecord {
  course: Course;
  units: Unit[];
}

export const courses: CourseRecord[] = [];
export const lessons = new Map<string, Lesson>();
export const items = new Map<string, Item>();
export const skills = new Map<string, Skill & { courseId: string; unitTitle: string; position: number }>();
/** Skill id → its lesson ids (in level order). */
export const lessonsBySkill = new Map<string, string[]>();
/** Course id → its item ids. */
export const itemsByCourse = new Map<string, string[]>();
/** Skill code → skill id (codes are unique across the catalog). */
export const skillIdByCode = new Map<string, string>();

let unitN = 0;
let skillN = 0;
let lessonN = 0;
let itemN = 0;

COURSE_SEEDS.forEach((seed, courseIndex) => {
  const courseId = seedUuid(ID_KIND.course, courseIndex + 1);
  const courseItems: string[] = [];
  const units: Unit[] = seed.units.map((unitSeed, unitIndex) => {
    const unitId = seedUuid(ID_KIND.unit, ++unitN);
    const unitSkills: Skill[] = unitSeed.skills.map((skillSeed) => {
      const skillId = seedUuid(ID_KIND.skill, ++skillN);
      skillIdByCode.set(skillSeed.code, skillId);
      const skill: Skill = {
        id: asId(skillId),
        unitId: asId(unitId),
        code: skillSeed.code,
        name: skillSeed.name,
        prerequisiteIds: (skillSeed.prerequisites ?? []).map((code) => {
          const id = skillIdByCode.get(code);
          if (!id) throw new Error(`Unknown prerequisite ${code} for ${skillSeed.code}`);
          return asId(id);
        }),
      };
      skills.set(skillId, { ...skill, courseId, unitTitle: unitSeed.title, position: skillN });

      const itemIds = skillSeed.items.map((itemSeed) => {
        const itemId = seedUuid(ID_KIND.item, ++itemN);
        items.set(itemId, { ...itemSeed, id: asId(itemId), skillId: asId(skillId) } as Item);
        courseItems.push(itemId);
        return itemId;
      });

      const lessonId = seedUuid(ID_KIND.lesson, ++lessonN);
      const blocks: LessonBlock[] = skillSeed.lesson.blocks.map((block) => {
        if (block.kind !== "check") return block;
        const itemId = itemIds[block.item];
        if (!itemId) throw new Error(`Lesson ${skillSeed.lesson.slug} checks a missing item`);
        return { kind: "check", itemId: asId(itemId) };
      });
      lessons.set(lessonId, {
        id: asId(lessonId),
        skillId: asId(skillId),
        slug: skillSeed.lesson.slug,
        title: skillSeed.lesson.title,
        level: skillSeed.lesson.level,
        estimatedMinutes: skillSeed.lesson.estimatedMinutes,
        blocks,
      });
      lessonsBySkill.set(skillId, [lessonId]);
      return skill;
    });
    return { id: asId(unitId), courseId: asId(courseId), position: unitIndex + 1, title: unitSeed.title, summary: unitSeed.summary, skills: unitSkills };
  });
  itemsByCourse.set(courseId, courseItems);
  courses.push({
    course: {
      id: asId(courseId),
      slug: seed.slug,
      title: seed.title,
      subject: seed.subject,
      gradeBand: seed.gradeBand,
      description: seed.description,
      coverHue: seed.coverHue,
      unitCount: units.length,
      estimatedMinutes: seed.estimatedMinutes,
    },
    units,
  });
});

export function courseBySlug(slug: string): CourseRecord | undefined {
  return courses.find((record) => record.course.slug === slug);
}

export function courseById(id: string): CourseRecord | undefined {
  return courses.find((record) => record.course.id === id);
}

export function courseSkills(record: CourseRecord): Skill[] {
  return record.units.flatMap((unit) => unit.skills);
}
