import { mc, num, order, text, type SeedCourse, type SeedUnit } from "./types.js";

/** Grades 3–5. Follows the common progression: unit fractions → number line → equivalence → comparing → operations. */

const whatIsAFraction: SeedUnit = {
  title: "What is a fraction?",
  summary: "Fractions name equal parts of a whole and have their own place on the number line.",
  skills: [
    {
      code: "FR.1",
      name: "Fractions as equal parts",
      lessons: [
        {
          slug: "equal-parts-make-fractions",
          title: "Equal parts make fractions",
          level: 1,
          estimatedMinutes: 6,
          blocks: [
            { kind: "heading", text: "Sharing fairly" },
            {
              kind: "paragraph",
              text: "A fraction names part of a whole that has been cut into equal parts. When you share a pizza fairly between 4 friends, each friend gets one of 4 equal parts — one fourth, written 1/4.",
            },
            {
              kind: "callout",
              tone: "remember",
              text: "The bottom number (the denominator) tells how many equal parts the whole is cut into. The top number (the numerator) tells how many of those parts we are talking about.",
            },
            {
              kind: "example",
              prompt: "A chocolate bar has 6 equal pieces. Maya eats 2. What fraction of the bar did she eat?",
              steps: [
                "Count all the equal pieces: 6. That's the denominator.",
                "Count the pieces Maya ate: 2. That's the numerator.",
                "Write the numerator over the denominator.",
              ],
              answer: "2/6",
            },
            { kind: "check", item: "denominator" },
            {
              kind: "callout",
              tone: "tip",
              text: "Parts must be equal! A pizza cut into one huge slice and three tiny slices is not cut into fourths, even though there are four pieces.",
            },
            {
              kind: "paragraph",
              text: "Fractions can describe groups, too. If 3 of 10 marbles are blue, then 3/10 of the marbles are blue — the whole group is the denominator.",
            },
            { kind: "check", item: "groups" },
          ],
        },
      ],
      items: [
        mc("denominator", {
          prompt: "In the fraction 3/8, what does the 8 tell you?",
          choices: [
            "The whole is cut into 8 equal parts",
            "8 parts are shaded",
            "There are 8 wholes",
            "You add 3 and 8",
          ],
          correct: 0,
          difficulty: -1.6,
          hints: ["The bottom number is called the denominator.", "The denominator counts all the equal parts in one whole."],
          explanation:
            "The denominator (bottom number) tells how many equal parts make one whole. In 3/8 the whole is cut into 8 equal parts, and we're talking about 3 of them.",
        }),
        num("slices", {
          prompt: "A pizza is cut into equal slices. Each slice is 1/6 of the pizza. How many slices are in the whole pizza?",
          answer: 6,
          difficulty: -1.2,
          hints: ["The denominator tells how many equal parts make the whole.", "1/6 means one of 6 equal parts."],
          explanation: "1/6 means one part out of 6 equal parts, so the whole pizza has 6 slices.",
        }),
        mc("fourths", {
          prompt: "Which sandwich is cut into fourths?",
          choices: [
            "A sandwich cut into 4 equal pieces",
            "A sandwich cut into 4 pieces of different sizes",
            "A sandwich cut into 2 equal pieces",
            "A sandwich cut into 8 equal pieces",
          ],
          correct: 0,
          difficulty: -0.8,
          hints: ["Fourths means 4 parts…", "…and every part has to be the same size."],
          explanation:
            "Fourths are 4 equal parts. Four pieces of different sizes aren't fourths, even though there are four of them.",
        }),
        text("garden", {
          prompt: "A garden has 5 equal rows. Tomatoes grow in 2 of the rows. What fraction of the rows have tomatoes? (Write it like 1/2.)",
          accept: ["2/5", "two fifths", "two-fifths"],
          difficulty: -0.4,
          hints: ["How many rows are there in all? That's the denominator.", "How many rows have tomatoes? That's the numerator."],
          explanation: "There are 5 equal rows (denominator) and 2 have tomatoes (numerator), so 2/5 of the rows have tomatoes.",
        }),
        num("colored", {
          prompt: "A paper strip has 8 equal parts. Leo colored 5/8 of the strip. How many parts did he color?",
          answer: 5,
          difficulty: -0.9,
          hints: ["The numerator tells how many parts we're talking about."],
          explanation: "In 5/8 the numerator is 5, so Leo colored 5 of the 8 equal parts.",
        }),
        order("naming-steps", {
          prompt: "Put the steps for naming a fraction in order.",
          steps: [
            "Check that the parts are equal",
            "Count all the equal parts to find the denominator",
            "Count the parts you're describing to find the numerator",
            "Write the numerator over the denominator",
          ],
          difficulty: 0.2,
          hints: ["Before counting anything, make sure the parts are fair shares.", "The fraction is written last."],
          explanation:
            "First make sure the parts are equal, then count all of them (denominator), then the ones you're describing (numerator), and finally write numerator over denominator.",
        }),
        mc("groups", {
          prompt: "There are 10 marbles in a bag. 3 are blue. What fraction of the marbles are blue?",
          choices: ["3/10", "3/7", "7/10", "10/3"],
          correct: 0,
          difficulty: 0.4,
          hints: ["The whole is the whole bag of marbles.", "How many marbles are in the bag altogether?"],
          explanation:
            "The whole group has 10 marbles, so the denominator is 10, and 3 are blue: 3/10. (3/7 compares blue marbles to the other marbles — that's a ratio, not a fraction of the whole.)",
        }),
      ],
    },
    {
      code: "FR.2",
      name: "Fractions on a number line",
      prerequisites: ["FR.1"],
      lessons: [
        {
          slug: "fractions-on-the-number-line",
          title: "Fractions live on the number line",
          level: 2,
          estimatedMinutes: 7,
          blocks: [
            { kind: "heading", text: "Between 0 and 1" },
            {
              kind: "paragraph",
              text: "Fractions are numbers, so they have a place on the number line. To show fourths, split the space from 0 to 1 into 4 equal jumps. Each jump is 1/4.",
            },
            {
              kind: "example",
              prompt: "Where is 3/4 on a number line from 0 to 1?",
              steps: [
                "Split the line from 0 to 1 into 4 equal parts.",
                "Each part is 1/4.",
                "Start at 0 and count 3 jumps: 1/4, 2/4, 3/4.",
              ],
              answer: "Three jumps from 0 — one jump before 1.",
            },
            {
              kind: "callout",
              tone: "tip",
              text: "4/4 lands exactly on 1. Whenever the numerator and denominator match, the fraction equals one whole.",
            },
            { kind: "check", item: "first-tick" },
            { kind: "check", item: "closest-to-zero" },
          ],
        },
      ],
      items: [
        num("jumps", {
          prompt: "A number line from 0 to 1 is split into 5 equal jumps. How many jumps from 0 is the point 3/5?",
          answer: 3,
          difficulty: -1.0,
          hints: ["Each jump is 1/5.", "Count fifths: 1/5, 2/5, 3/5…"],
          explanation: "Each jump is 1/5, so 3/5 is 3 jumps from 0.",
        }),
        mc("first-tick", {
          prompt: "A number line from 0 to 1 is split into 3 equal parts. What fraction is at the first tick mark after 0?",
          choices: ["1/3", "1/2", "3/1", "1/4"],
          correct: 0,
          difficulty: -0.9,
          hints: ["How many equal parts is the space from 0 to 1 split into?"],
          explanation: "The space from 0 to 1 is split into 3 equal parts, so each jump is 1/3. The first tick after 0 is 1/3.",
        }),
        mc("one-whole", {
          prompt: "Which fraction sits exactly on 1 on the number line?",
          choices: ["6/6", "1/6", "5/6", "0/6"],
          correct: 0,
          difficulty: -0.3,
          hints: ["One whole means all of the equal parts."],
          explanation: "6/6 means all 6 of the 6 equal parts — one whole — so it sits exactly on 1.",
        }),
        num("tenths", {
          prompt: "On a number line from 0 to 1 split into 10 equal parts, a point is at 7/10. What decimal is that? (Type it like 0.5)",
          answer: 0.7,
          tolerance: 0.001,
          difficulty: 0.6,
          hints: ["Tenths are the first place after the decimal point.", "7 tenths is written 0.?"],
          explanation: "7/10 is seven tenths, which is written 0.7 as a decimal.",
        }),
        text("halfway", {
          prompt: "What fraction is exactly halfway between 0 and 1 on the number line? (Write it like 1/3.)",
          accept: ["1/2", "2/4", "one half", "half"],
          difficulty: -0.6,
          hints: ["Split the space from 0 to 1 into 2 equal parts."],
          explanation: "Splitting 0 to 1 into 2 equal parts puts the halfway point at 1/2.",
        }),
        order("closest-to-zero", {
          prompt: "Order these fractions from closest to 0 to closest to 1.",
          steps: ["1/8", "3/8", "5/8", "7/8"],
          difficulty: 0.1,
          hints: ["They are all eighths, so the parts are the same size.", "Fewer eighths means closer to 0."],
          explanation: "With the same denominator, the fraction with fewer parts is closer to 0: 1/8, 3/8, 5/8, 7/8.",
        }),
        num("to-two", {
          prompt: "A number line from 0 to 2 is split into fourths. How many fourths are there from 0 to 2?",
          answer: 8,
          difficulty: 1.1,
          hints: ["How many fourths make 1 whole?", "Two wholes need twice as many."],
          explanation: "4 fourths make 1 whole, so 2 wholes are 4 + 4 = 8 fourths.",
        }),
      ],
    },
  ],
};

const equivalentAndComparing: SeedUnit = {
  title: "Equivalent and comparing fractions",
  summary: "Different fractions can name the same amount — and that's the key to comparing them.",
  skills: [
    {
      code: "FR.3",
      name: "Equivalent fractions",
      prerequisites: ["FR.1"],
      lessons: [
        {
          slug: "same-amount-different-names",
          title: "Same amount, different names",
          level: 2,
          estimatedMinutes: 8,
          blocks: [
            { kind: "heading", text: "Equivalent fractions" },
            {
              kind: "paragraph",
              text: "Fold a paper strip in half and shade one half. Now fold it in half again: the same shaded part is now 2 of 4 equal parts. 1/2 and 2/4 name the same amount — they are equivalent.",
            },
            {
              kind: "callout",
              tone: "remember",
              text: "Multiply (or divide) the numerator and the denominator by the same number and you get an equivalent fraction. You're cutting the same whole into more (or fewer) pieces.",
            },
            {
              kind: "example",
              prompt: "Find the missing number: 2/3 = ?/12",
              steps: ["What times 3 makes 12? 3 × 4 = 12.", "Do the same to the top: 2 × 4 = 8.", "So 2/3 = 8/12."],
              answer: "8",
            },
            { kind: "callout", tone: "try", text: "Can you find two more fractions that are equal to 1/2?" },
            { kind: "check", item: "missing-numerator" },
            { kind: "check", item: "simplest" },
          ],
        },
      ],
      items: [
        num("missing-numerator", {
          prompt: "Find the missing numerator: 2/3 = ?/12",
          answer: 8,
          difficulty: 0.0,
          hints: ["What do you multiply 3 by to get 12?", "Multiply the 2 by that same number."],
          explanation: "3 × 4 = 12, so multiply the numerator by 4 as well: 2 × 4 = 8. 2/3 = 8/12.",
        }),
        mc("half", {
          prompt: "Which fraction is equivalent to 1/2?",
          choices: ["3/6", "2/3", "1/4", "2/5"],
          correct: 0,
          difficulty: -1.1,
          hints: ["Half of the parts should be chosen.", "What is half of 6?"],
          explanation: "3 is half of 6, so 3/6 is the same amount as 1/2.",
        }),
        num("missing-denominator", {
          prompt: "Find the missing denominator: 3/4 = 9/?",
          answer: 12,
          difficulty: 0.4,
          hints: ["What did 3 get multiplied by to make 9?", "Multiply the 4 by the same number."],
          explanation: "3 × 3 = 9, so multiply the denominator by 3 as well: 4 × 3 = 12. 3/4 = 9/12.",
        }),
        text("simplest", {
          prompt: "Write 6/8 in simplest form.",
          accept: ["3/4"],
          difficulty: 0.8,
          hints: ["Find a number that divides both 6 and 8.", "Both 6 and 8 can be divided by 2."],
          explanation: "Divide the numerator and denominator by 2: 6 ÷ 2 = 3 and 8 ÷ 2 = 4, so 6/8 = 3/4.",
        }),
        mc("not-equivalent", {
          prompt: "Which fraction is NOT equivalent to 2/5?",
          choices: ["4/10", "6/15", "4/7", "8/20"],
          correct: 2,
          difficulty: 0.5,
          hints: ["Equivalent fractions come from multiplying top and bottom by the same number.", "Check each one: what was 2 multiplied by? Was 5 multiplied by the same number?"],
          explanation:
            "4/7 adds 2 to the top and bottom instead of multiplying, so it isn't equivalent. 4/10, 6/15 and 8/20 all multiply 2/5 by the same number on top and bottom.",
        }),
        order("make-twentieths", {
          prompt: "Put the steps in order to make a fraction equal to 3/5 with a denominator of 20.",
          steps: [
            "Ask: what times 5 makes 20?",
            "Find that 5 × 4 = 20",
            "Multiply the numerator by the same number: 3 × 4 = 12",
            "Write the new fraction: 12/20",
          ],
          difficulty: 0.3,
          hints: ["Start with the denominator you want."],
          explanation: "Find the multiplier from the denominators (×4), apply it to the numerator, then write 12/20.",
        }),
        num("pizza-slices", {
          prompt: "Ava ate 2/8 of a pizza. Ben ate the same amount of an equal-sized pizza that was cut into 4 slices. How many slices did Ben eat?",
          answer: 1,
          difficulty: 0.9,
          hints: ["2/8 = ?/4", "Divide the top and bottom of 2/8 by 2."],
          explanation: "2/8 = 1/4, so Ben ate 1 of his 4 slices.",
        }),
      ],
    },
    {
      code: "FR.4",
      name: "Comparing fractions",
      prerequisites: ["FR.2", "FR.3"],
      lessons: [
        {
          slug: "which-fraction-is-bigger",
          title: "Which fraction is bigger?",
          level: 3,
          estimatedMinutes: 8,
          blocks: [
            { kind: "heading", text: "Comparing fractions" },
            {
              kind: "paragraph",
              text: "When two fractions have the same denominator, the parts are the same size, so just compare the numerators: 5/8 is greater than 3/8.",
            },
            {
              kind: "paragraph",
              text: "When the numerators are the same, compare the size of the parts. 1/3 is bigger than 1/5, because cutting a whole into 3 pieces makes bigger pieces than cutting it into 5.",
            },
            { kind: "check", item: "unit-fractions" },
            {
              kind: "callout",
              tone: "tip",
              text: "Different numerators and denominators? Rewrite them with a common denominator, then compare the numerators.",
            },
            {
              kind: "example",
              prompt: "Compare 2/3 and 3/4.",
              steps: ["Find a common denominator: 12.", "2/3 = 8/12 and 3/4 = 9/12.", "9/12 is more than 8/12."],
              answer: "3/4 > 2/3",
            },
            { kind: "check", item: "smallest-to-largest" },
          ],
        },
      ],
      items: [
        mc("same-denominator", {
          prompt: "Which is greater: 5/8 or 3/8?",
          choices: ["5/8", "3/8", "They are equal"],
          correct: 0,
          difficulty: -1.3,
          hints: ["Both are eighths, so the pieces are the same size."],
          explanation: "Both are eighths, so compare how many pieces: 5 eighths is more than 3 eighths.",
        }),
        mc("unit-fractions", {
          prompt: "Which is greater: 1/3 or 1/5?",
          choices: ["1/3", "1/5", "They are equal"],
          correct: 0,
          difficulty: -0.2,
          hints: ["Picture a pizza cut into 3 slices and one cut into 5.", "Which slices are bigger?"],
          explanation: "Thirds are bigger pieces than fifths, so one third is more than one fifth.",
        }),
        text("symbol", {
          prompt: "Fill in the symbol (<, > or =): 2/4 __ 1/2",
          accept: ["="],
          difficulty: 0.2,
          hints: ["Is 2/4 equivalent to any simpler fraction?"],
          explanation: "2/4 simplifies to 1/2, so they are equal: 2/4 = 1/2.",
        }),
        order("smallest-to-largest", {
          prompt: "Order these fractions from smallest to largest.",
          steps: ["1/6", "1/3", "1/2", "5/6"],
          difficulty: 0.9,
          hints: ["Rewrite them all as sixths.", "1/3 = 2/6 and 1/2 = 3/6."],
          explanation: "In sixths they are 1/6, 2/6, 3/6 and 5/6, so the order is 1/6, 1/3, 1/2, 5/6.",
        }),
        num("twelfths", {
          prompt: "To compare 2/3 and 3/4, you rewrite both as twelfths. What is the numerator of 3/4 written in twelfths?",
          answer: 9,
          difficulty: 0.6,
          hints: ["4 × 3 = 12", "Multiply the 3 on top by 3 as well."],
          explanation: "3/4 = (3 × 3)/(4 × 3) = 9/12.",
        }),
        mc("benchmark-half", {
          prompt: "Which fraction is greater than 1/2?",
          choices: ["3/5", "2/5", "1/4", "3/8"],
          correct: 0,
          difficulty: 0.7,
          hints: ["Half of 5 is 2.5. Is the numerator more than half the denominator?"],
          explanation: "A fraction is greater than 1/2 when its numerator is more than half its denominator. Half of 5 is 2.5, and 3 > 2.5.",
        }),
        mc("misconception", {
          prompt: "Sam says 1/8 is bigger than 1/4 because 8 is bigger than 4. Is Sam right?",
          choices: [
            "No — eighths are smaller pieces than fourths, so 1/8 < 1/4",
            "Yes — 8 is bigger than 4",
            "Yes — bigger denominators always mean bigger fractions",
            "No — they are equal",
          ],
          correct: 0,
          difficulty: 0.4,
          hints: ["The denominator tells how many pieces the whole is cut into.", "More pieces means each piece is…?"],
          explanation: "Cutting a whole into 8 pieces makes smaller pieces than cutting it into 4, so 1/8 is less than 1/4.",
        }),
      ],
    },
  ],
};

const addingFractions: SeedUnit = {
  title: "Adding and subtracting fractions",
  summary: "Combine fractions with the same denominator, then go beyond one whole with mixed numbers.",
  skills: [
    {
      code: "FR.5",
      name: "Adding and subtracting like fractions",
      prerequisites: ["FR.3"],
      lessons: [
        {
          slug: "adding-like-fractions",
          title: "Adding fractions with the same denominator",
          level: 3,
          estimatedMinutes: 8,
          blocks: [
            { kind: "heading", text: "Same-size pieces add up" },
            {
              kind: "paragraph",
              text: "If you have 2/7 of a cake and someone gives you 3/7 more, you have 5/7. The pieces are all sevenths, so you just count them: 2 sevenths + 3 sevenths = 5 sevenths.",
            },
            {
              kind: "callout",
              tone: "remember",
              text: "Add (or subtract) the numerators. Keep the denominator the same — the size of the pieces doesn't change!",
            },
            {
              kind: "example",
              prompt: "3/10 + 4/10",
              steps: ["The denominators match: both are tenths.", "Add the numerators: 3 + 4 = 7.", "Keep the denominator: tenths."],
              answer: "7/10",
            },
            { kind: "check", item: "add-tenths" },
            {
              kind: "callout",
              tone: "try",
              text: "Watch out for 1/4 + 1/4 = 2/8. Is that right? Draw it and see!",
            },
            { kind: "check", item: "fourths-trap" },
          ],
        },
      ],
      items: [
        text("add-tenths", {
          prompt: "3/10 + 4/10 = ? (Write it like 1/2.)",
          accept: ["7/10"],
          difficulty: -0.8,
          hints: ["The denominators are the same.", "Add only the numerators: 3 + 4."],
          explanation: "Tenths plus tenths are still tenths: 3 + 4 = 7, so the answer is 7/10.",
        }),
        mc("fourths-trap", {
          prompt: "What is 1/4 + 1/4?",
          choices: ["2/4", "2/8", "1/8", "1/16"],
          correct: 0,
          difficulty: -0.3,
          hints: ["Are the pieces getting smaller when you add them?", "Fourths plus fourths are still fourths."],
          explanation:
            "Adding fourths to fourths gives fourths: 2/4 (which is the same as 1/2). 2/8 would mean the pieces got smaller, but they didn't.",
        }),
        num("subtract-ninths", {
          prompt: "7/9 − 4/9 = ?/9. What is the missing numerator?",
          answer: 3,
          difficulty: -0.5,
          hints: ["Subtract the numerators and keep the ninths."],
          explanation: "7 ninths take away 4 ninths leaves 3 ninths: 3/9.",
        }),
        num("walk", {
          prompt: "Kai walked 2/6 of a mile in the morning and 3/6 of a mile after lunch. How many sixths of a mile did he walk in all?",
          answer: 5,
          difficulty: 0.2,
          hints: ["Both distances are in sixths.", "Add 2 sixths and 3 sixths."],
          explanation: "2/6 + 3/6 = 5/6 of a mile, which is 5 sixths.",
        }),
        mc("make-a-whole", {
          prompt: "3/5 + 2/5 equals…",
          choices: ["1 whole", "5/10", "1/5", "6/5"],
          correct: 0,
          difficulty: 0.4,
          hints: ["Add the numerators: 3 + 2.", "What is 5/5?"],
          explanation: "3/5 + 2/5 = 5/5, and five fifths make one whole.",
        }),
        order("subtract-steps", {
          prompt: "Put the steps for solving 5/8 − 2/8 in order.",
          steps: [
            "Check that the denominators are the same",
            "Subtract the numerators: 5 − 2 = 3",
            "Keep the denominator: 8",
            "Write the answer: 3/8",
          ],
          difficulty: 0.0,
          hints: ["You can only subtract the numerators once you know the pieces are the same size."],
          explanation: "Check the denominators match, subtract the numerators, keep the denominator, and write 3/8.",
        }),
        num("slices-left", {
          prompt: "A pizza had 8 equal slices. The family ate 5/8 of it. How many slices are left?",
          answer: 3,
          difficulty: 0.6,
          hints: ["The whole pizza is 8/8.", "8/8 − 5/8 = ?"],
          explanation: "The whole pizza is 8/8. 8/8 − 5/8 = 3/8, so 3 slices are left.",
        }),
      ],
    },
    {
      code: "FR.6",
      name: "Mixed numbers",
      prerequisites: ["FR.5"],
      lessons: [
        {
          slug: "more-than-one-whole",
          title: "More than one whole",
          level: 4,
          estimatedMinutes: 9,
          blocks: [
            { kind: "heading", text: "Mixed numbers and improper fractions" },
            {
              kind: "paragraph",
              text: "Sometimes we have more than one whole. 7/4 means seven fourths. Four of those fourths make one whole, with 3/4 left over, so 7/4 = 1 3/4. We call 1 3/4 a mixed number.",
            },
            {
              kind: "example",
              prompt: "Write 11/3 as a mixed number.",
              steps: [
                "How many groups of 3 thirds fit in 11 thirds? 3 groups (9 thirds).",
                "That's 3 wholes.",
                "11 − 9 = 2 thirds left over.",
              ],
              answer: "3 2/3",
            },
            {
              kind: "callout",
              tone: "tip",
              text: "To go back, multiply the whole number by the denominator and add the numerator: 3 2/3 = (3 × 3 + 2)/3 = 11/3.",
            },
            { kind: "check", item: "to-mixed" },
            { kind: "check", item: "to-improper" },
          ],
        },
      ],
      items: [
        text("to-mixed", {
          prompt: "Write 7/4 as a mixed number. (Write it like 1 1/2.)",
          accept: ["1 3/4", "1 and 3/4"],
          difficulty: 0.5,
          hints: ["How many fourths make one whole?", "7 fourths = 4 fourths + 3 fourths."],
          explanation: "4 of the 7 fourths make 1 whole, and 3 fourths are left: 1 3/4.",
        }),
        num("to-improper", {
          prompt: "Write 2 1/3 as an improper fraction. What is the numerator? (The denominator is 3.)",
          answer: 7,
          difficulty: 0.6,
          hints: ["Each whole is 3 thirds.", "2 wholes = 6 thirds. Add the extra third."],
          explanation: "2 wholes are 6 thirds, plus 1 more third makes 7 thirds: 7/3.",
        }),
        mc("compare-to-two", {
          prompt: "Which is greater: 9/4 or 2?",
          choices: ["9/4", "2", "They are equal"],
          correct: 0,
          difficulty: 0.9,
          hints: ["How many fourths are in 2 wholes?"],
          explanation: "2 = 8/4, and 9/4 is one fourth more, so 9/4 (which is 2 1/4) is greater.",
        }),
        num("wholes", {
          prompt: "How many wholes are in 12/4?",
          answer: 3,
          difficulty: -0.4,
          hints: ["Every 4 fourths make 1 whole.", "12 ÷ 4 = ?"],
          explanation: "Every 4 fourths make a whole, and 12 ÷ 4 = 3, so 12/4 = 3 wholes.",
        }),
        mc("add-mixed", {
          prompt: "1 1/5 + 2 3/5 = ?",
          choices: ["3 4/5", "3 4/10", "4 4/5", "3 2/5"],
          correct: 0,
          difficulty: 1.2,
          hints: ["Add the whole numbers, then add the fractions.", "1 + 2 = 3 and 1/5 + 3/5 = ?"],
          explanation: "Add wholes: 1 + 2 = 3. Add fifths: 1/5 + 3/5 = 4/5. Together that's 3 4/5.",
        }),
        order("order-mixed", {
          prompt: "Order from smallest to largest.",
          steps: ["3/4", "5/4", "1 1/2", "7/4"],
          difficulty: 1.4,
          hints: ["Write them all as fourths.", "1 1/2 = 6/4."],
          explanation: "As fourths they are 3/4, 5/4, 6/4 and 7/4, so the order is 3/4, 5/4, 1 1/2, 7/4.",
        }),
        text("recipe", {
          prompt: "A recipe needs 5/2 cups of flour. Write that as a mixed number.",
          accept: ["2 1/2", "2 and 1/2"],
          difficulty: 1.0,
          hints: ["How many halves make one whole cup?", "5 halves = 2 wholes and 1 half."],
          explanation: "Two halves make a whole cup, so 5 halves are 2 whole cups and 1 half left over: 2 1/2 cups.",
        }),
      ],
    },
  ],
};

export const fractions: SeedCourse = {
  slug: "fractions-foundations",
  title: "Fractions Foundations",
  subject: "math",
  gradeBand: "3-5",
  description:
    "Build a rock-solid understanding of fractions — from fair shares and the number line to equivalent fractions, comparing, adding and mixed numbers.",
  coverHue: 245,
  position: 1,
  units: [whatIsAFraction, equivalentAndComparing, addingFractions],
};
