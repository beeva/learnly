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

const waterAndWeather: SeedUnit = {
  title: "Water and weather",
  summary: "Follow water around the planet and measure the weather like a meteorologist.",
  skills: [
    {
      code: "ES.3",
      name: "The water cycle",
      lessons: [
        {
          slug: "where-does-rain-come-from",
          title: "Where does rain come from?",
          level: 1,
          estimatedMinutes: 7,
          blocks: [
            { kind: "heading", text: "Water on the move" },
            {
              kind: "paragraph",
              text: "The water on Earth keeps moving in a loop called the water cycle. The sun warms water in oceans and lakes, and it evaporates into water vapor. High in the sky the vapor cools and condenses into tiny droplets that form clouds. When the droplets get heavy, they fall as precipitation — rain, snow, sleet or hail. The water collects in oceans, lakes and underground, ready to start again.",
            },
            {
              kind: "callout",
              tone: "remember",
              text: "Evaporation (up), condensation (clouds), precipitation (down), collection (gather).",
            },
            {
              kind: "example",
              prompt: "Why does a cold glass of lemonade “sweat” on a hot day?",
              steps: [
                "Air holds invisible water vapor.",
                "The cold glass cools the air touching it.",
                "Cooled vapor condenses into droplets on the glass.",
              ],
              answer: "Condensation",
            },
            { kind: "check", item: "evaporation" },
            { kind: "check", item: "cycle-order" },
          ],
        },
      ],
      items: [
        mc("evaporation", {
          prompt: "What is it called when liquid water turns into water vapor?",
          choices: ["Evaporation", "Condensation", "Precipitation", "Collection"],
          correct: 0,
          difficulty: -1.0,
          hints: ["It's what happens to a puddle on a sunny day."],
          explanation: "Evaporation is liquid water turning into invisible water vapor, usually because it's warmed.",
        }),
        order("cycle-order", {
          prompt: "Put the stages of the water cycle in order, starting with water in the ocean.",
          steps: ["Evaporation", "Condensation", "Precipitation", "Collection"],
          difficulty: -0.4,
          hints: ["Water has to go up before it can come down."],
          explanation: "Ocean water evaporates, condenses into clouds, falls as precipitation, then collects again.",
        }),
        text("clouds", {
          prompt: "Clouds form when water vapor cools and turns into tiny droplets. What is this process called?",
          accept: ["condensation"],
          difficulty: -0.2,
          hints: ["It's the same thing that makes a cold glass “sweat”."],
          explanation: "Vapor turning back into liquid droplets is condensation.",
        }),
        mc("energy", {
          prompt: "What gives the water cycle its energy?",
          choices: ["The sun", "The moon", "The wind", "Volcanoes"],
          correct: 0,
          difficulty: 0.2,
          hints: ["What warms the oceans?"],
          explanation: "The sun's heat drives evaporation, which keeps the whole cycle moving.",
        }),
        num("not-ocean", {
          prompt: "About 97 out of every 100 liters of Earth's water is salty ocean water. How many liters out of 100 are NOT ocean water?",
          answer: 3,
          difficulty: 0.0,
          hints: ["100 − 97 = ?"],
          explanation: "100 − 97 = 3. Only about 3 liters in every 100 are fresh water — and most of that is frozen.",
        }),
        mc("puddle", {
          prompt: "A puddle disappears on a sunny afternoon. Where did the water go?",
          choices: ["It evaporated into the air", "It soaked into the clouds", "It froze", "It turned into soil"],
          correct: 0,
          difficulty: 0.5,
          hints: ["The sun warmed the puddle."],
          explanation: "The sun warmed the water and it evaporated into the air as water vapor.",
        }),
      ],
    },
    {
      code: "ES.4",
      name: "Measuring weather",
      prerequisites: ["ES.3"],
      lessons: [
        {
          slug: "weather-tools",
          title: "Weather tools",
          level: 2,
          estimatedMinutes: 7,
          blocks: [
            { kind: "heading", text: "Think like a meteorologist" },
            {
              kind: "paragraph",
              text: "Meteorologists measure weather with tools. A thermometer measures temperature. A rain gauge collects and measures rainfall. An anemometer spins in the wind to measure wind speed, and a barometer measures air pressure — falling pressure often means a storm is on its way.",
            },
            { kind: "callout", tone: "tip", text: "Always read a rain gauge at eye level, from the bottom of the curved water surface." },
            {
              kind: "example",
              prompt: "A rain gauge showed 12 mm on Monday and 7 mm on Tuesday. How much rain fell in total?",
              steps: ["Add the two days: 12 + 7."],
              answer: "19 mm",
            },
            { kind: "check", item: "wind-tool" },
            { kind: "check", item: "rain-total" },
          ],
        },
      ],
      items: [
        mc("wind-tool", {
          prompt: "Which tool measures wind speed?",
          choices: ["Anemometer", "Thermometer", "Rain gauge", "Barometer"],
          correct: 0,
          difficulty: -0.4,
          hints: ["It has little cups that spin in the wind."],
          explanation: "An anemometer's cups spin faster as the wind blows harder, measuring wind speed.",
        }),
        num("rain-total", {
          prompt: "A rain gauge showed 12 mm on Monday, 7 mm on Tuesday and 6 mm on Wednesday. How many millimetres of rain fell in all?",
          answer: 25,
          unit: "mm",
          difficulty: -0.6,
          hints: ["Add all three days."],
          explanation: "12 + 7 + 6 = 25 mm of rain.",
        }),
        num("temperature-rise", {
          prompt: "The temperature was 18°C in the morning and 27°C in the afternoon. By how many degrees did it rise?",
          answer: 9,
          unit: "°C",
          difficulty: -0.8,
          hints: ["Find the difference: 27 − 18."],
          explanation: "27 − 18 = 9, so it rose by 9 degrees.",
        }),
        text("thermometer", {
          prompt: "Which tool measures temperature?",
          accept: ["thermometer", "a thermometer"],
          difficulty: -1.4,
          hints: ["“Thermo” means heat."],
          explanation: "A thermometer measures temperature.",
        }),
        mc("falling-pressure", {
          prompt: "The barometer shows the air pressure dropping quickly. What weather is most likely coming?",
          choices: ["A storm", "Clear, sunny skies", "A heat wave with no clouds", "No change at all"],
          correct: 0,
          difficulty: 0.7,
          hints: ["Reread the last sentence of the lesson paragraph."],
          explanation: "Quickly falling air pressure usually means a storm is approaching.",
        }),
        order("rain-steps", {
          prompt: "Put the steps for measuring daily rainfall in order.",
          steps: [
            "Place the rain gauge in an open area",
            "Wait 24 hours",
            "Read the water level at eye level",
            "Record the measurement and empty the gauge",
          ],
          difficulty: 0.1,
          hints: ["You can't read the gauge until rain has had time to fall."],
          explanation: "Set the gauge up in the open, wait a day, read it at eye level, then record and empty it for tomorrow.",
        }),
        num("average-rain", {
          prompt: "Over 4 days a class recorded 10 mm, 6 mm, 0 mm and 8 mm of rain. What was the average daily rainfall in mm?",
          answer: 6,
          unit: "mm",
          difficulty: 1.2,
          hints: ["Add all four days, then divide by 4.", "Don't forget the 0 mm day counts too!"],
          explanation: "10 + 6 + 0 + 8 = 24, and 24 ÷ 4 = 6 mm per day.",
        }),
      ],
    },
  ],
};

export const earthScience: SeedCourse = {
  slug: "earth-science-explorers",
  title: "Earth Science Explorers",
  subject: "science",
  gradeBand: "3-5",
  description: "Investigate the rocks under your feet and the water over your head — how they form, move and change.",
  coverHue: 158,
  position: 4,
  units: [rocks, waterAndWeather],
};
