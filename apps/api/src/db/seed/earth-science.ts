import { mc, num, order, text, type SeedCourse, type SeedUnit } from "./types.js";

/** Grades 3–5 earth science: how rocks form and change, and how water and weather work. */

const rocks: SeedUnit = {
  title: "Rocks and the rock cycle",
  summary: "Three families of rocks, and the slow journey that turns one into another.",
  skills: [
    {
      code: "ES.1",
      name: "Types of rocks",
      lessons: [
        {
          slug: "three-families-of-rocks",
          title: "Three families of rocks",
          level: 1,
          estimatedMinutes: 7,
          blocks: [
            { kind: "heading", text: "How was this rock made?" },
            {
              kind: "paragraph",
              text: "Geologists sort rocks into three families based on how they formed. Igneous rocks form when melted rock (magma or lava) cools and hardens. Sedimentary rocks form when layers of sand, mud and shells are pressed together over a very long time. Metamorphic rocks form when heat and pressure deep underground change a rock into a new kind of rock.",
            },
            {
              kind: "callout",
              tone: "remember",
              text: "Igneous = from fire. Sedimentary = settled layers. Metamorphic = changed form.",
            },
            {
              kind: "example",
              prompt: "A rock has visible stripes of layers and a tiny fossil shell inside. Which family is it from?",
              steps: [
                "Layers form when sediment settles over time.",
                "Shells get trapped in settling mud and sand and become fossils.",
              ],
              answer: "Sedimentary",
            },
            { kind: "check", item: "from-lava" },
            { kind: "check", item: "marble" },
          ],
        },
      ],
      items: [
        mc("from-lava", {
          prompt: "Which kind of rock forms when lava cools and hardens?",
          choices: ["Igneous", "Sedimentary", "Metamorphic", "Fossil"],
          correct: 0,
          difficulty: -1.2,
          hints: ["Lava is melted rock.", "Which family name means “from fire”?"],
          explanation: "Igneous rocks form when melted rock — magma underground or lava at the surface — cools and hardens.",
        }),
        mc("fossils", {
          prompt: "In which kind of rock are you most likely to find fossils?",
          choices: ["Sedimentary", "Igneous", "Metamorphic", "All of them equally"],
          correct: 0,
          difficulty: -0.3,
          hints: ["Fossils need to be buried gently, not melted or crushed."],
          explanation: "Plants and animals get buried in layers of mud and sand, which become sedimentary rock. Melting or heavy squeezing usually destroys fossils.",
        }),
        text("marble", {
          prompt: "Marble forms when limestone is changed by heat and pressure. Which family of rock is marble?",
          accept: ["metamorphic", "metamorphic rock"],
          difficulty: 0.4,
          hints: ["Which family is made by changing an existing rock?"],
          explanation: "Heat and pressure changed limestone into marble, so marble is a metamorphic rock.",
        }),
        num("families", {
          prompt: "How many main families of rocks do geologists use?",
          answer: 3,
          difficulty: -1.5,
          hints: ["Igneous, sedimentary and…?"],
          explanation: "There are three: igneous, sedimentary and metamorphic.",
        }),
        order("sedimentary-steps", {
          prompt: "Put the steps for forming sedimentary rock in order.",
          steps: [
            "Wind and water break rocks into tiny pieces",
            "Rivers carry the sediment to a lake or sea",
            "Layers of sediment settle and pile up",
            "Over a long time the layers are pressed and cemented into rock",
          ],
          difficulty: 0.2,
          hints: ["Sediment has to be made before it can be carried anywhere."],
          explanation: "Rocks are broken into sediment, carried by water, settle into layers, and are slowly pressed into rock.",
        }),
        mc("obsidian", {
          prompt: "Obsidian is a shiny black rock that cooled from lava so fast that crystals had no time to grow. What kind of rock is it?",
          choices: ["Igneous", "Sedimentary", "Metamorphic", "It isn't a rock"],
          correct: 0,
          difficulty: 0.5,
          hints: ["Where did obsidian come from?"],
          explanation: "Obsidian formed from cooling lava, so it's igneous — natural volcanic glass.",
        }),
      ],
    },
    {
      code: "ES.2",
      name: "The rock cycle",
      prerequisites: ["ES.1"],
      lessons: [
        {
          slug: "rocks-are-always-changing",
          title: "Rocks are always changing",
          level: 2,
          estimatedMinutes: 8,
          blocks: [
            { kind: "heading", text: "The rock cycle" },
            {
              kind: "paragraph",
              text: "Rocks may look like they last forever, but over thousands to millions of years they change from one type to another. This never-ending journey is called the rock cycle. Weathering breaks rocks down, sediment builds up, heat and pressure transform rocks, and melting turns them back into magma.",
            },
            {
              kind: "callout",
              tone: "tip",
              text: "There's no single starting point in the rock cycle. Any kind of rock can become any other kind.",
            },
            {
              kind: "example",
              prompt: "How can an igneous rock become a sedimentary rock?",
              steps: [
                "Weathering breaks the igneous rock into sediment.",
                "Water carries the sediment and it settles in layers.",
                "The layers are pressed and cemented into sedimentary rock.",
              ],
              answer: "Weathering, then settling, then pressing",
            },
            { kind: "check", item: "melt" },
          ],
        },
      ],
      items: [
        mc("melt", {
          prompt: "What has to happen for a metamorphic rock to become an igneous rock?",
          choices: ["It melts and then cools", "It is weathered into sand", "It is buried under mud", "It is polished by a river"],
          correct: 0,
          difficulty: 0.1,
          hints: ["How do igneous rocks form?"],
          explanation: "Igneous rocks form from cooled melted rock, so the metamorphic rock must melt into magma and then cool.",
        }),
        mc("weathering", {
          prompt: "What is weathering?",
          choices: ["Breaking rock into smaller pieces", "Melting rock into magma", "Pressing layers together", "Cooling lava"],
          correct: 0,
          difficulty: -0.8,
          hints: ["Think of rain, ice and wind wearing a rock down."],
          explanation: "Weathering is the breaking of rock into smaller pieces by water, ice, wind, plants and temperature changes.",
        }),
        text("cycle-name", {
          prompt: "What is the name for the never-ending process in which rocks change from one type into another?",
          accept: ["rock cycle", "the rock cycle"],
          difficulty: -1.0,
          hints: ["It goes round and round, like the water cycle."],
          explanation: "It's called the rock cycle.",
        }),
        order("granite-to-sandstone", {
          prompt: "Put the steps in order to turn granite (an igneous rock) into sandstone.",
          steps: [
            "Granite is weathered into sand grains",
            "Rivers carry the sand to the sea",
            "Sand settles in thick layers",
            "The layers are pressed and cemented into sandstone",
          ],
          difficulty: 0.6,
          hints: ["Sandstone is sedimentary. How does sedimentary rock form?"],
          explanation: "Weathering makes sand, water carries it, it settles in layers, and pressure cements it into sandstone.",
        }),
        num("magma-cooling", {
          prompt: "Magma at 1,100°C cools by 200°C. What is its new temperature in °C?",
          answer: 900,
          unit: "°C",
          difficulty: -0.2,
          hints: ["Cooling means the temperature goes down.", "1,100 − 200 = ?"],
          explanation: "1,100 − 200 = 900°C. At that temperature parts of the magma begin to crystallise into igneous rock.",
        }),
        mc("how-long", {
          prompt: "About how long does it usually take for the rock cycle to change one rock into another?",
          choices: ["Thousands to millions of years", "A few days", "About one year", "Exactly 100 years"],
          correct: 0,
          difficulty: 0.3,
          hints: ["Think about how slowly layers of mud build up."],
          explanation: "Most rock-cycle changes are extremely slow — thousands to millions of years. (A volcanic eruption is a rare fast exception.)",
        }),
      ],
    },
  ],
};

