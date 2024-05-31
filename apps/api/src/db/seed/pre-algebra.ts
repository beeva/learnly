import { mc, num, order, text, type SeedCourse, type SeedUnit } from "./types.js";

/** Grades 6–8: integers → expressions → equations, the on-ramp to Algebra 1. */

const integers: SeedUnit = {
  title: "Integers",
  summary: "Negative numbers, the number line, and the sign rules that make them work.",
  skills: [
    {
      code: "PA.1",
      name: "Adding and subtracting integers",
      lessons: [
        {
          slug: "integers-on-the-number-line",
          title: "Integers on the number line",
          level: 2,
          estimatedMinutes: 7,
          blocks: [
            { kind: "heading", text: "Moving left and right" },
            {
              kind: "paragraph",
              text: "Integers are whole numbers and their opposites: …, −3, −2, −1, 0, 1, 2, 3, …. On a number line, adding a positive number moves you right; adding a negative number moves you left.",
            },
            {
              kind: "example",
              prompt: "−4 + 7",
              steps: ["Start at −4 on the number line.", "Adding 7 means moving 7 steps right.", "−4 → −3 → −2 → −1 → 0 → 1 → 2 → 3."],
              answer: "3",
            },
            {
              kind: "callout",
              tone: "remember",
              text: "Subtracting a number is the same as adding its opposite: 5 − (−3) = 5 + 3 = 8.",
            },
            { kind: "check", item: "add" },
            { kind: "check", item: "subtract-negative" },
          ],
        },
      ],
      items: [
        num("add", {
          prompt: "−4 + 7 = ?",
          answer: 3,
          difficulty: -1.0,
          hints: ["Start at −4 and move right.", "How many steps does it take to get from −4 to 0?"],
          explanation: "From −4, moving 4 steps right reaches 0, and 3 more steps reach 3.",
        }),
        num("subtract-negative", {
          prompt: "5 − (−3) = ?",
          answer: 8,
          difficulty: 0.2,
          hints: ["Subtracting a negative is the same as adding its opposite."],
          explanation: "5 − (−3) = 5 + 3 = 8. Taking away a debt of 3 leaves you 3 better off.",
        }),
        mc("temperature", {
          prompt: "The temperature was −6°C at dawn and rose 9 degrees by noon. What was the temperature at noon?",
          choices: ["3°C", "−15°C", "15°C", "−3°C"],
          correct: 0,
          difficulty: -0.3,
          hints: ["Rising means adding.", "−6 + 9 = ?"],
          explanation: "−6 + 9 = 3, so it was 3°C at noon.",
        }),
        num("two-negatives", {
          prompt: "−8 + (−5) = ?",
          answer: -13,
          difficulty: -0.1,
          hints: ["Adding a negative moves you further left.", "Both numbers are negative, so the answer is too."],
          explanation: "Start at −8 and move 5 more to the left: −13.",
        }),
        text("opposite", {
          prompt: "What is the opposite of −12?",
          accept: ["12", "+12", "positive 12"],
          difficulty: -1.5,
          hints: ["Opposites are the same distance from 0 on opposite sides."],
          explanation: "−12 is 12 steps left of 0; its opposite is 12 steps right of 0: 12.",
        }),
        order("least-to-greatest", {
          prompt: "Order from least to greatest.",
          steps: ["−9", "−4", "0", "2", "7"],
          difficulty: -0.6,
          hints: ["Numbers further left on the number line are smaller.", "−9 is further left than −4."],
          explanation: "On the number line from left to right: −9, −4, 0, 2, 7.",
        }),
        mc("diver", {
          prompt: "A diver is at −20 m. She swims up 8 m, then down 5 m. Where is she now?",
          choices: ["−17 m", "−23 m", "−33 m", "−7 m"],
          correct: 0,
          difficulty: 0.7,
          hints: ["Up is +, down is −.", "−20 + 8 − 5 = ?"],
          explanation: "−20 + 8 = −12, then −12 − 5 = −17. She is 17 m below the surface.",
        }),
      ],
    },
    {
      code: "PA.2",
      name: "Multiplying and dividing integers",
      prerequisites: ["PA.1"],
      lessons: [
        {
          slug: "integer-sign-rules",
          title: "Sign rules for multiplying and dividing",
          level: 3,
          estimatedMinutes: 7,
          blocks: [
            { kind: "heading", text: "Same signs, different signs" },
            {
              kind: "paragraph",
              text: "Multiply or divide the numbers as usual, then decide the sign. Same signs give a positive answer; different signs give a negative answer.",
            },
            {
              kind: "callout",
              tone: "tip",
              text: "Think of (−3) × 4 as four groups of −3: −3 − 3 − 3 − 3 = −12.",
            },
            {
              kind: "example",
              prompt: "(−6) × (−7)",
              steps: ["Multiply the numbers: 6 × 7 = 42.", "The signs are the same (both negative).", "Same signs give a positive answer."],
              answer: "42",
            },
            { kind: "check", item: "multiply" },
          ],
        },
      ],
      items: [
        num("multiply", {
          prompt: "(−6) × (−7) = ?",
          answer: 42,
          difficulty: 0.0,
          hints: ["Multiply 6 × 7 first.", "Two negatives make a positive."],
          explanation: "6 × 7 = 42, and the signs are the same, so the answer is positive: 42.",
        }),
        num("divide", {
          prompt: "−48 ÷ 6 = ?",
          answer: -8,
          difficulty: -0.2,
          hints: ["48 ÷ 6 = 8.", "The signs are different."],
          explanation: "48 ÷ 6 = 8, and a negative divided by a positive is negative: −8.",
        }),
        mc("sign-of-product", {
          prompt: "What is the sign of (−2) × 5 × (−3) × (−1)?",
          choices: ["Negative", "Positive", "Zero", "It depends"],
          correct: 0,
          difficulty: 0.9,
          hints: ["Count the negative factors.", "Each pair of negatives makes a positive."],
          explanation: "There are three negative factors. Two of them pair up to make a positive, and one is left over, so the product (−30) is negative.",
        }),
        num("stock", {
          prompt: "A stock price drops $3 every day for 5 days. What is the total change in dollars? (Use a negative number for a drop.)",
          answer: -15,
          difficulty: 0.3,
          hints: ["A drop of $3 is −3.", "5 days × (−3) = ?"],
          explanation: "5 × (−3) = −15, so the price changed by −$15.",
        }),
        text("rule", {
          prompt: "Complete the rule: a negative number divided by a negative number is ___.",
          accept: ["positive", "a positive number", "positive number"],
          difficulty: -0.5,
          hints: ["Are the signs the same or different?"],
          explanation: "The signs are the same, so the quotient is positive.",
        }),
        order("divide-steps", {
          prompt: "Put the steps for computing −36 ÷ (−4) in order.",
          steps: [
            "Ignore the signs and divide: 36 ÷ 4 = 9",
            "Look at the signs: both are negative",
            "Same signs give a positive answer",
            "Write the answer: 9",
          ],
          difficulty: -0.1,
          hints: ["Work out the size of the answer first, then its sign."],
          explanation: "Divide 36 ÷ 4 = 9, notice both signs are negative, so the answer is positive 9.",
        }),
        mc("square", {
          prompt: "What is (−5)²?",
          choices: ["25", "−25", "10", "−10"],
          correct: 0,
          difficulty: 0.8,
          hints: ["(−5)² means (−5) × (−5).", "Same signs…"],
          explanation: "(−5)² = (−5) × (−5) = 25. The parentheses mean the negative sign is squared too.",
        }),
      ],
    },
  ],
};

const expressions: SeedUnit = {
  title: "Expressions",
  summary: "Order of operations and evaluating expressions with variables.",
  skills: [
    {
      code: "PA.3",
      name: "Order of operations",
      lessons: [
        {
          slug: "order-of-operations",
          title: "Order of operations",
          level: 2,
          estimatedMinutes: 8,
          blocks: [
            { kind: "heading", text: "Everyone gets the same answer" },
            {
              kind: "paragraph",
              text: "When an expression has more than one operation, we agree on an order so everyone gets the same answer: parentheses, exponents, multiplication and division (left to right), then addition and subtraction (left to right).",
            },
            {
              kind: "callout",
              tone: "remember",
              text: "Multiplication doesn't always come before division — they share a step and go left to right. The same is true for addition and subtraction.",
            },
            {
              kind: "example",
              prompt: "3 + 4 × 2",
              steps: ["Multiplication comes before addition: 4 × 2 = 8.", "Then add: 3 + 8 = 11."],
              answer: "11",
            },
            { kind: "check", item: "basic" },
            { kind: "check", item: "left-to-right" },
          ],
        },
      ],
      items: [
        num("basic", {
          prompt: "3 + 4 × 2 = ?",
          answer: 11,
          difficulty: -1.0,
          hints: ["Which comes first, + or ×?"],
          explanation: "Multiply first: 4 × 2 = 8. Then add: 3 + 8 = 11.",
        }),
        num("parentheses", {
          prompt: "(3 + 4) × 2 = ?",
          answer: 14,
          difficulty: -1.2,
          hints: ["Parentheses come first."],
          explanation: "Parentheses first: 3 + 4 = 7. Then 7 × 2 = 14.",
        }),
        num("exponent", {
          prompt: "2 + 3² × 2 = ?",
          answer: 20,
          difficulty: 0.3,
          hints: ["Exponents before multiplication.", "3² = 9."],
          explanation: "3² = 9, then 9 × 2 = 18, then 2 + 18 = 20.",
        }),
        mc("left-to-right", {
          prompt: "What is 24 ÷ 4 × 2?",
          choices: ["12", "3", "48", "6"],
          correct: 0,
          difficulty: 0.6,
          hints: ["Multiplication and division share a step.", "Work from left to right."],
          explanation: "Left to right: 24 ÷ 4 = 6, then 6 × 2 = 12. (Multiplying first would give 3, which is a common slip.)",
        }),
        order("steps", {
          prompt: "Put the steps for 18 − (2 + 4) × 2 in the right order.",
          steps: ["Parentheses: 2 + 4 = 6", "Multiply: 6 × 2 = 12", "Subtract: 18 − 12 = 6"],
          difficulty: 0.0,
          hints: ["Parentheses first, subtraction last."],
          explanation: "Parentheses (6), then multiplication (12), then subtraction (18 − 12 = 6).",
        }),
        text("which-first", {
          prompt: "In 10 − 2 × 3, which operation comes first: subtraction or multiplication?",
          accept: ["multiplication", "multiply", "multiplying"],
          difficulty: -1.4,
          hints: ["Multiplication and division come before addition and subtraction."],
          explanation: "Multiplication comes first: 2 × 3 = 6, then 10 − 6 = 4.",
        }),
        num("challenge", {
          prompt: "40 ÷ (5 + 3) + 2 × 3² = ?",
          answer: 23,
          difficulty: 1.3,
          hints: ["Parentheses: 5 + 3 = 8. Exponent: 3² = 9.", "Then 40 ÷ 8 and 2 × 9."],
          explanation: "40 ÷ 8 = 5 and 2 × 9 = 18, so 5 + 18 = 23.",
        }),
      ],
    },
    {
      code: "PA.4",
      name: "Evaluating expressions",
      prerequisites: ["PA.3"],
      lessons: [
        {
          slug: "variables-are-placeholders",
          title: "Variables are placeholders",
          level: 3,
          estimatedMinutes: 7,
          blocks: [
            { kind: "heading", text: "Substitute, then simplify" },
            {
              kind: "paragraph",
              text: "A variable is a letter that stands for a number. To evaluate an expression, replace each variable with its value, then follow the order of operations.",
            },
            {
              kind: "callout",
              tone: "tip",
              text: "Use parentheses when you substitute negative numbers: if x = −2, then 3x = 3(−2) = −6.",
            },
            {
              kind: "example",
              prompt: "Evaluate 4n − 5 when n = 3.",
              steps: ["Replace n with 3: 4(3) − 5.", "Multiply: 12 − 5.", "Subtract."],
              answer: "7",
            },
            { kind: "check", item: "simple" },
            { kind: "check", item: "negative" },
          ],
        },
      ],
      items: [
        num("simple", {
          prompt: "Evaluate 4n − 5 when n = 3.",
          answer: 7,
          difficulty: -0.8,
          hints: ["4n means 4 × n."],
          explanation: "4 × 3 − 5 = 12 − 5 = 7.",
        }),
        num("two-variables", {
          prompt: "Evaluate 2a + b when a = 6 and b = 4.",
          answer: 16,
          difficulty: -0.3,
          hints: ["Replace a with 6 and b with 4."],
          explanation: "2 × 6 + 4 = 12 + 4 = 16.",
        }),
        num("negative", {
          prompt: "Evaluate 3x + 10 when x = −2.",
          answer: 4,
          difficulty: 0.4,
          hints: ["3x = 3 × (−2)."],
          explanation: "3 × (−2) = −6, and −6 + 10 = 4.",
        }),
        mc("meaning", {
          prompt: "What does 5m mean?",
          choices: ["5 times m", "5 plus m", "5 minus m", "A two-digit number starting with 5"],
          correct: 0,
          difficulty: -1.2,
          hints: ["A number written next to a variable is multiplied by it."],
          explanation: "Writing a number next to a variable means multiplication: 5m = 5 × m.",
        }),
        text("write-expression", {
          prompt: "Write an expression for “seven more than a number y”.",
          accept: ["y + 7", "y+7", "7 + y", "7+y"],
          difficulty: 0.3,
          hints: ["“More than” means add."],
          explanation: "Seven more than y means y plus 7: y + 7 (or 7 + y).",
        }),
        order("evaluate-steps", {
          prompt: "Put the steps for evaluating 2(x + 3)² when x = 1 in order.",
          steps: ["Substitute: 2(1 + 3)²", "Parentheses: 1 + 3 = 4", "Exponent: 4² = 16", "Multiply: 2 × 16 = 32"],
          difficulty: 0.9,
          hints: ["Substitute first, then follow the order of operations."],
          explanation: "Substitute, then parentheses (4), exponent (16), multiplication (32).",
        }),
        num("area", {
          prompt: "The area of a rectangle is A = l × w. What is the area when l = 9 cm and w = 4 cm?",
          answer: 36,
          unit: "cm²",
          difficulty: -0.6,
          hints: ["Replace l with 9 and w with 4."],
          explanation: "A = 9 × 4 = 36 square centimetres.",
        }),
      ],
    },
  ],
};

const equations: SeedUnit = {
  title: "Equations",
  summary: "Solving one- and two-step equations by keeping both sides balanced.",
  skills: [
    {
      code: "PA.5",
      name: "One-step equations",
      prerequisites: ["PA.4"],
      lessons: [
        {
          slug: "keep-the-balance",
          title: "Keep the balance",
          level: 3,
          estimatedMinutes: 8,
          blocks: [
            { kind: "heading", text: "Equations are balanced scales" },
            {
              kind: "paragraph",
              text: "An equation is like a balanced scale: both sides are equal. To find the variable, undo what was done to it — and do the same thing to both sides so the scale stays balanced.",
            },
            {
              kind: "callout",
              tone: "remember",
              text: "Addition and subtraction undo each other. Multiplication and division undo each other.",
            },
            {
              kind: "example",
              prompt: "x + 9 = 15",
              steps: ["9 is added to x, so subtract 9.", "Subtract 9 from both sides: x + 9 − 9 = 15 − 9."],
              answer: "x = 6",
            },
            { kind: "callout", tone: "try", text: "Check your answer by substituting it back: 6 + 9 = 15. ✓" },
            { kind: "check", item: "addition" },
            { kind: "check", item: "inverse" },
          ],
        },
      ],
      items: [
        num("addition", {
          prompt: "Solve x + 9 = 15. What is x?",
          answer: 6,
          difficulty: -1.0,
          hints: ["Undo + 9 by subtracting 9 from both sides."],
          explanation: "x + 9 − 9 = 15 − 9, so x = 6.",
        }),
        num("multiplication", {
          prompt: "Solve 4y = 28. What is y?",
          answer: 7,
          difficulty: -0.6,
          hints: ["4y means 4 × y.", "Undo × 4 by dividing by 4."],
          explanation: "Divide both sides by 4: y = 28 ÷ 4 = 7.",
        }),
        num("division", {
          prompt: "Solve n ÷ 3 = 5. What is n?",
          answer: 15,
          difficulty: -0.2,
          hints: ["Undo ÷ 3 by multiplying by 3."],
          explanation: "Multiply both sides by 3: n = 5 × 3 = 15.",
        }),
        num("negative-result", {
          prompt: "Solve m − 8 = −3. What is m?",
          answer: 5,
          difficulty: 0.4,
          hints: ["Add 8 to both sides.", "−3 + 8 = ?"],
          explanation: "Add 8 to both sides: m = −3 + 8 = 5.",
        }),
        mc("inverse", {
          prompt: "To solve 6k = 42, what should you do to both sides?",
          choices: ["Divide by 6", "Subtract 6", "Multiply by 6", "Add 42"],
          correct: 0,
          difficulty: -0.9,
          hints: ["k is being multiplied by 6. What undoes multiplication?"],
          explanation: "6k means 6 × k, and division undoes multiplication, so divide both sides by 6 (k = 7).",
        }),
        text("check-solution", {
          prompt: "Is x = 4 a solution of 3x − 2 = 10? Answer yes or no.",
          accept: ["yes"],
          difficulty: 0.0,
          hints: ["Substitute 4 for x and see if both sides match."],
          explanation: "3 × 4 − 2 = 12 − 2 = 10, which matches, so yes.",
        }),
        order("solve-steps", {
          prompt: "Put the steps for solving x/5 = 7 in order.",
          steps: ["Notice that x is divided by 5", "Multiply both sides by 5", "Simplify: x = 35", "Check: 35 ÷ 5 = 7"],
          difficulty: -0.3,
          hints: ["Figure out what was done to x before undoing it."],
          explanation: "x is divided by 5, so multiply both sides by 5 to get x = 35, then check by substituting.",
        }),
      ],
    },
    {
      code: "PA.6",
      name: "Two-step equations",
      prerequisites: ["PA.5", "PA.2"],
      lessons: [
        {
          slug: "two-step-equations",
          title: "Two-step equations",
          level: 4,
          estimatedMinutes: 9,
          blocks: [
            { kind: "heading", text: "Undo in reverse order" },
            {
              kind: "paragraph",
              text: "In 3x + 4 = 19, two things happened to x: it was multiplied by 3, then 4 was added. To solve, undo them in reverse order — like taking off your shoes before your socks.",
            },
            {
              kind: "example",
              prompt: "3x + 4 = 19",
              steps: [
                "Undo the addition: subtract 4 from both sides → 3x = 15.",
                "Undo the multiplication: divide both sides by 3 → x = 5.",
                "Check: 3(5) + 4 = 19. ✓",
              ],
              answer: "x = 5",
            },
            { kind: "callout", tone: "tip", text: "Undo addition or subtraction first, then multiplication or division." },
            { kind: "check", item: "basic" },
            { kind: "check", item: "first-step" },
          ],
        },
      ],
      items: [
        num("basic", {
          prompt: "Solve 3x + 4 = 19. What is x?",
          answer: 5,
          difficulty: 0.2,
          hints: ["Subtract 4 from both sides first.", "3x = 15."],
          explanation: "3x + 4 = 19 → 3x = 15 → x = 5.",
        }),
        num("subtraction", {
          prompt: "Solve 5y − 7 = 18. What is y?",
          answer: 5,
          difficulty: 0.4,
          hints: ["Add 7 to both sides first."],
          explanation: "5y − 7 = 18 → 5y = 25 → y = 5.",
        }),
        num("negative-coefficient", {
          prompt: "Solve −2n + 3 = 11. What is n?",
          answer: -4,
          difficulty: 1.1,
          hints: ["Subtract 3 from both sides: −2n = 8.", "Divide both sides by −2."],
          explanation: "−2n + 3 = 11 → −2n = 8 → n = 8 ÷ (−2) = −4.",
        }),
        mc("first-step", {
          prompt: "What is the best first step to solve 4x − 9 = 23?",
          choices: ["Add 9 to both sides", "Divide both sides by 4", "Subtract 9 from both sides", "Multiply both sides by 4"],
          correct: 0,
          difficulty: 0.0,
          hints: ["Undo addition or subtraction first.", "What undoes − 9?"],
          explanation: "Undo the subtraction first by adding 9 to both sides: 4x = 32. Then divide by 4: x = 8.",
        }),
        text("taxi-equation", {
          prompt: "A taxi charges $3 plus $2 per mile. A ride cost $17. Write an equation using m for the miles (like 2m + 3 = 17).",
          accept: ["2m + 3 = 17", "2m+3=17", "3 + 2m = 17", "3+2m=17"],
          difficulty: 0.9,
          hints: ["The per-mile charge is 2 × m.", "Add the $3 starting fee and set it equal to the total."],
          explanation: "$2 for each of m miles is 2m, plus the $3 fee, equals the $17 total: 2m + 3 = 17.",
        }),
        num("taxi-miles", {
          prompt: "A taxi charges $3 plus $2 per mile. A ride cost $17. How many miles was the ride?",
          answer: 7,
          difficulty: 0.6,
          hints: ["2m + 3 = 17", "Subtract 3, then divide by 2."],
          explanation: "2m + 3 = 17 → 2m = 14 → m = 7 miles.",
        }),
        order("fraction-steps", {
          prompt: "Put the steps for solving x/2 − 5 = 1 in order.",
          steps: ["Add 5 to both sides: x/2 = 6", "Multiply both sides by 2: x = 12", "Check: 12/2 − 5 = 1"],
          difficulty: 0.8,
          hints: ["Undo the subtraction before the division."],
          explanation: "Add 5 (x/2 = 6), multiply by 2 (x = 12), then check by substituting.",
        }),
      ],
    },
  ],
};

export const preAlgebra: SeedCourse = {
  slug: "pre-algebra",
  title: "Pre-Algebra",
  subject: "math",
  gradeBand: "6-8",
  description:
    "Get confident with negative numbers, the order of operations, variables and equations — everything you need before Algebra 1.",
  coverHue: 268,
  position: 2,
  units: [integers, expressions, equations],
};
