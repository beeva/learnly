import { mc, num, order, text, type SeedCourse, type SeedUnit } from "./types.js";

/** Grades 3–5 reading comprehension, framed as detective work: every answer needs a clue. */

const BEES =
  "Honeybees work as a team. Some bees gather nectar from flowers. Others guard the hive from intruders. Young bees clean the cells and feed the babies. Even the queen has one job: laying eggs. Every bee helps the hive survive.";

const SLEEP =
  "Sleep helps your body and your brain. While you sleep, your muscles repair themselves. Your brain sorts the things you learned during the day. Kids who sleep enough often find it easier to focus at school.";

const PANCAKES =
  "On Saturday, Dad and Jonah made pancakes. First, they measured the flour, sugar and baking powder into a bowl. Next, Jonah cracked two eggs and stirred in the milk. After the batter rested for five minutes, Dad poured small circles onto the hot pan. When bubbles popped on top, Jonah flipped each pancake. Finally, they shared the stack with Grandma.";

const WALLET =
  "Theo found a wallet on the bus seat. Inside were twenty dollars and a library card. His friend whispered, “Nobody would know if you kept it.” Theo shook his head and walked straight to the driver. “Someone will be worried about this,” he said.";

const read = (passage: string, question: string) => `${passage}\n\n${question}`;

const cluesInTheText: SeedUnit = {
  title: "Clues in the text",
  summary: "Find the big idea and use nearby words to crack unfamiliar vocabulary.",
  skills: [
    {
      code: "RD.1",
      name: "Main idea and details",
      lessons: [
        {
          slug: "finding-the-main-idea",
          title: "Finding the main idea",
          level: 1,
          estimatedMinutes: 6,
          blocks: [
            { kind: "heading", text: "What is it mostly about?" },
            {
              kind: "paragraph",
              text: "The main idea is the most important point the author wants you to understand. Details are the facts and examples that support it. A good test: if you had to tell a friend what the paragraph is about in one sentence, what would you say?",
            },
            {
              kind: "callout",
              tone: "tip",
              text: "Look at the first and last sentences — authors often state the main idea there. Then check that the details support it.",
            },
            {
              kind: "example",
              prompt:
                "“Octopuses are clever problem solvers. They can open jars to reach food. Some escape from their tanks at night. One octopus learned to turn off a light by squirting water at it.” What is the main idea?",
              steps: [
                "Ask what every sentence has in common.",
                "Opening jars, escaping tanks and squirting a light all show clever thinking.",
                "The first sentence says it directly.",
              ],
              answer: "Octopuses are clever problem solvers.",
            },
            { kind: "check", item: "bees-main-idea" },
            { kind: "check", item: "bees-detail" },
          ],
        },
      ],
      items: [
        mc("bees-main-idea", {
          prompt: read(BEES, "What is the main idea?"),
          choices: [
            "Honeybees work as a team to help the hive survive",
            "Some bees gather nectar",
            "The queen lays eggs",
            "Bees live in hives",
          ],
          correct: 0,
          difficulty: -1.0,
          hints: ["Which answer do all the sentences support?", "Check the first and last sentences."],
          explanation: "Every sentence describes a bee doing a job for the hive, and the first and last sentences say it: honeybees work as a team so the hive survives.",
        }),
        mc("bees-detail", {
          prompt: read(BEES, "Which detail supports the main idea?"),
          choices: ["Others guard the hive from intruders.", "Flowers are colorful.", "Honey is sweet.", "Bees can sting."],
          correct: 0,
          difficulty: -0.7,
          hints: ["A supporting detail must come from the passage.", "Which choice shows a bee doing a job?"],
          explanation: "Guarding the hive is a job one group of bees does for the team. The other choices aren't in the passage.",
        }),
        num("bees-groups", {
          prompt: read(BEES, "How many different groups of bees does the passage describe?"),
          answer: 4,
          difficulty: 0.2,
          hints: ["Look for words like “some”, “others”, “young bees” and “the queen”."],
          explanation: "Nectar gatherers, guards, young bees and the queen: 4 groups.",
        }),
        text("bees-team", {
          prompt: read(BEES, "Finish the phrase from the first sentence: Honeybees work as a ____."),
          accept: ["team"],
          difficulty: -1.4,
          hints: ["Reread the very first sentence."],
          explanation: "The first sentence says “Honeybees work as a team.” That's also the main idea.",
        }),
        order("main-idea-steps", {
          prompt: "Put the steps for finding a main idea in order.",
          steps: [
            "Read the whole paragraph",
            "Notice what most sentences are about",
            "Check the first and last sentences",
            "Say the main idea in one sentence",
          ],
          difficulty: -0.3,
          hints: ["You need to read before you can decide anything."],
          explanation: "Read it all, notice the common topic, check the first and last sentences, then sum it up in one sentence.",
        }),
        mc("sleep-off-topic", {
          prompt: read(SLEEP, "Which sentence would NOT belong in this paragraph?"),
          choices: [
            "My cousin has a red bike.",
            "Sleep also helps your body fight germs.",
            "Growing bodies need more sleep than adults.",
            "A rested brain remembers spelling words better.",
          ],
          correct: 0,
          difficulty: 0.3,
          hints: ["The paragraph is about how sleep helps us.", "Which sentence has nothing to do with sleep?"],
          explanation: "Every other choice is about how sleep helps. A cousin's red bike doesn't support the main idea.",
        }),
        mc("sleep-main-idea", {
          prompt: read(SLEEP, "Which is the best main idea?"),
          choices: ["Sleep helps your body and your brain", "Muscles repair themselves", "Kids go to school", "Brains sort things"],
          correct: 0,
          difficulty: -0.2,
          hints: ["A main idea covers the whole paragraph, not just one sentence."],
          explanation: "Muscles repairing and brains sorting are details. The main idea, stated first, is that sleep helps your body and brain.",
        }),
      ],
    },
    {
      code: "RD.2",
      name: "Context clues",
      lessons: [
        {
          slug: "be-a-word-detective",
          title: "Be a word detective",
          level: 2,
          estimatedMinutes: 7,
          blocks: [
            { kind: "heading", text: "Let the sentence help you" },
            {
              kind: "paragraph",
              text: "When you meet a word you don't know, the sentences around it often hold clues. Authors may give a definition, an example, a synonym (a word that means the same) or an antonym (a word that means the opposite).",
            },
            { kind: "callout", tone: "tip", text: "Look for signal words: “which means”, “or”, “such as”, “like”, “but”, “unlike”." },
            {
              kind: "example",
              prompt: "“The trail was so steep and arduous that we had to stop and rest every few minutes.” What does arduous mean?",
              steps: [
                "Find the clues: “steep” and “had to stop and rest”.",
                "Something that makes you rest often must be very hard.",
                "So arduous means difficult and tiring.",
              ],
              answer: "Very difficult and tiring",
            },
            { kind: "check", item: "famished" },
            { kind: "check", item: "timid" },
          ],
        },
      ],
      items: [
        mc("famished", {
          prompt: "“The puppy was famished, so it gobbled its whole bowl of food in seconds.” What does famished mean?",
          choices: ["Very hungry", "Very sleepy", "Very small", "Very muddy"],
          correct: 0,
          difficulty: -1.0,
          hints: ["What did the puppy do with its food?", "Why would you gobble food quickly?"],
          explanation: "Gobbling a whole bowl in seconds is a clue that the puppy was very hungry.",
        }),
        mc("timid", {
          prompt: "“Unlike his timid sister, Marco was bold and talked to everyone at the party.” What does timid mean?",
          choices: ["Shy", "Loud", "Kind", "Tall"],
          correct: 0,
          difficulty: -0.2,
          hints: ["“Unlike” signals an opposite.", "What's the opposite of bold?"],
          explanation: "“Unlike” tells us the sister is the opposite of bold and chatty, so timid means shy.",
        }),
        text("fragile", {
          prompt: "“The old bridge was fragile, or easy to break, so trucks were not allowed on it.” Which three words in the sentence tell you what fragile means?",
          accept: ["easy to break"],
          difficulty: 0.1,
          hints: ["The word “or” can introduce a definition."],
          explanation: "Right after “or”, the author defines fragile: “easy to break”.",
        }),
        mc("nocturnal", {
          prompt: "“Nocturnal animals, such as owls, bats and raccoons, hunt at night.” What does nocturnal mean?",
          choices: ["Active at night", "Living in trees", "Able to fly", "Very quiet"],
          correct: 0,
          difficulty: -0.6,
          hints: ["“Such as” gives examples.", "What do owls, bats and raccoons have in common in this sentence?"],
          explanation: "The examples all hunt at night, so nocturnal means active at night.",
        }),
        order("word-detective-steps", {
          prompt: "Put the word-detective steps in order.",
          steps: [
            "Stop at the unknown word",
            "Read the sentences around it",
            "Find clue words like “such as” or “unlike”",
            "Guess the meaning",
            "Reread the sentence with your guess to check it",
          ],
          difficulty: 0.4,
          hints: ["Checking your guess is always the last step."],
          explanation: "Notice the word, read around it, find clue words, make a guess, then check the guess makes sense.",
        }),
        num("arid-clues", {
          prompt: "“The desert is arid. It gets very little rain, the soil is dry and cracked, and few plants can grow.” How many clues in the second sentence help explain arid?",
          answer: 3,
          difficulty: 0.6,
          hints: ["Count the separate facts about the desert in the second sentence."],
          explanation: "Little rain, dry cracked soil, and few plants: 3 clues that arid means very dry.",
        }),
        mc("example-signal", {
          prompt: "Which signal words tell you an example is coming?",
          choices: ["such as", "but", "unlike", "however"],
          correct: 0,
          difficulty: -0.4,
          hints: ["“But”, “unlike” and “however” signal a contrast."],
          explanation: "“Such as” introduces examples. The others signal a contrast or an opposite.",
        }),
      ],
    },
  ],
};

const storyElements: SeedUnit = {
  title: "Story elements",
  summary: "Track what happens when, and get to know the characters it happens to.",
  skills: [
    {
      code: "RD.3",
      name: "Sequence of events",
      lessons: [
        {
          slug: "first-next-last",
          title: "First, next, last",
          level: 1,
          estimatedMinutes: 6,
          blocks: [
            { kind: "heading", text: "Stories happen in order" },
            {
              kind: "paragraph",
              text: "Stories happen in an order called the sequence. Understanding the sequence helps you follow what happened — and why.",
            },
            {
              kind: "callout",
              tone: "tip",
              text: "Signal words like first, next, then, after that, before, when and finally help you keep track of time.",
            },
            {
              kind: "example",
              prompt: "“Before the race, Mia stretched. Then she tied her shoes twice to be safe. When the whistle blew, she sprinted.” What did Mia do first?",
              steps: ["Find the time words: before, then, when.", "“Before the race” happens earliest."],
              answer: "She stretched.",
            },
            { kind: "check", item: "pancake-order" },
          ],
        },
      ],
      items: [
        order("pancake-order", {
          prompt: read(PANCAKES, "Put the events in order."),
          steps: [
            "They measured the dry ingredients",
            "Jonah cracked eggs and stirred in milk",
            "Dad poured batter onto the pan",
            "Jonah flipped the pancakes",
            "They shared the pancakes with Grandma",
          ],
          difficulty: -0.2,
          hints: ["Find the signal words: first, next, after, when, finally."],
          explanation: "First measuring, next eggs and milk, after resting the pouring, when bubbles popped the flipping, and finally sharing.",
        }),
        mc("after-resting", {
          prompt: read(PANCAKES, "What happened right after the batter rested?"),
          choices: ["Dad poured small circles onto the pan", "Jonah cracked the eggs", "They shared with Grandma", "They measured the flour"],
          correct: 0,
          difficulty: -0.5,
          hints: ["Find the sentence that starts with “After the batter rested”."],
          explanation: "The passage says, “After the batter rested for five minutes, Dad poured small circles onto the hot pan.”",
        }),
        num("rest-minutes", {
          prompt: read(PANCAKES, "How many minutes did the batter rest?"),
          answer: 5,
          difficulty: -1.3,
          hints: ["Look for a number word in the passage."],
          explanation: "The batter rested for five minutes.",
        }),
        text("last-signal", {
          prompt: read(PANCAKES, "Which signal word tells you about the last event?"),
          accept: ["finally"],
          difficulty: -0.9,
          hints: ["Look at the beginning of the last sentence."],
          explanation: "“Finally” signals the last event: sharing the pancakes with Grandma.",
        }),
        mc("flip-clue", {
          prompt: read(PANCAKES, "How did Jonah know when to flip a pancake?"),
          choices: ["Bubbles popped on top", "Dad told him", "A timer rang", "Grandma arrived"],
          correct: 0,
          difficulty: 0.0,
          hints: ["Find the sentence that starts with “When”."],
          explanation: "“When bubbles popped on top, Jonah flipped each pancake.” The bubbles were his signal.",
        }),
        order("plant-order", {
          prompt: "Put these events in the order they would happen.",
          steps: [
            "Plant a seed in soil",
            "Water it every day",
            "A tiny sprout pokes through the soil",
            "The leaves grow bigger",
            "A flower blooms",
          ],
          difficulty: -0.7,
          hints: ["Use what you know about how plants grow."],
          explanation: "A seed is planted and watered, sprouts, grows leaves and finally blooms.",
        }),
        mc("already-packed", {
          prompt: "“Before she left for school, Ana fed the cat. She had already packed her bag the night before.” Which happened first?",
          choices: ["Ana packed her bag", "Ana fed the cat", "Ana left for school", "They happened at the same time"],
          correct: 0,
          difficulty: 0.8,
          hints: ["The order of sentences isn't always the order of events.", "When did she pack her bag?"],
          explanation: "She packed her bag “the night before”, so that happened before feeding the cat in the morning.",
        }),
      ],
    },
    {
      code: "RD.4",
      name: "Character traits and feelings",
      prerequisites: ["RD.3"],
      lessons: [
        {
          slug: "getting-to-know-characters",
          title: "Getting to know characters",
          level: 2,
          estimatedMinutes: 7,
          blocks: [
            { kind: "heading", text: "Show, don't tell" },
            {
              kind: "paragraph",
              text: "A character trait describes what a character is like on the inside — brave, honest, curious, stubborn. Authors rarely tell you directly; they show you through what characters say, do and think.",
            },
            {
              kind: "callout",
              tone: "remember",
              text: "Feelings change during a story (nervous, proud). Traits usually stay the same (kind, patient).",
            },
            {
              kind: "example",
              prompt: "“Even though her hands shook, Priya raised her hand and asked the question everyone was wondering about.” What trait does Priya show?",
              steps: [
                "Her hands shook — she was nervous.",
                "But she still asked the question.",
                "Doing something even when you're scared shows courage.",
              ],
              answer: "Brave",
            },
            { kind: "check", item: "theo-trait" },
            { kind: "check", item: "trait-or-feeling" },
          ],
        },
      ],
      items: [
        mc("theo-trait", {
          prompt: read(WALLET, "Which trait best describes Theo?"),
          choices: ["Honest", "Greedy", "Lazy", "Shy"],
          correct: 0,
          difficulty: -1.0,
          hints: ["What did Theo do with the wallet?"],
          explanation: "Theo returned the wallet even though he could have kept the money. That shows he is honest.",
        }),
        mc("theo-evidence", {
          prompt: read(WALLET, "Which sentence best shows that Theo is honest?"),
          choices: [
            "Theo shook his head and walked straight to the driver.",
            "Inside were twenty dollars and a library card.",
            "Theo found a wallet on the bus seat.",
            "His friend whispered to him.",
          ],
          correct: 0,
          difficulty: 0.2,
          hints: ["Evidence for a trait is something the character does or says."],
          explanation: "Walking straight to the driver — and saying no to keeping it — is Theo's honest action.",
        }),
        text("lina-feeling", {
          prompt: "“Lina stared at the floor and her cheeks turned red when everyone laughed at her drawing.” Write one word for how Lina feels.",
          accept: ["embarrassed", "ashamed", "upset", "sad", "hurt", "humiliated"],
          difficulty: -0.3,
          hints: ["Staring at the floor and red cheeks are clues.", "How would you feel if people laughed at your drawing?"],
          explanation: "Looking down and blushing after being laughed at are signs Lina feels embarrassed or hurt.",
        }),
        mc("trait-or-feeling", {
          prompt: "Which word is a character TRAIT rather than a feeling?",
          choices: ["Patient", "Excited", "Scared", "Surprised"],
          correct: 0,
          difficulty: 0.5,
          hints: ["Traits describe what someone is usually like.", "Which word could describe a person all year long?"],
          explanation: "Patient describes what someone is like most of the time. Excited, scared and surprised are feelings that come and go.",
        }),
        num("wallet-dollars", {
          prompt: read(WALLET, "How many dollars were in the wallet?"),
          answer: 20,
          difficulty: -1.5,
          hints: ["Look at the second sentence."],
          explanation: "The wallet held twenty dollars and a library card.",
        }),
        order("trait-steps", {
          prompt: "Put the steps for figuring out a character trait in order.",
          steps: [
            "Notice what the character says, does or thinks",
            "Ask what that shows about them",
            "Choose a trait word",
            "Find evidence in the text to support it",
          ],
          difficulty: 0.0,
          hints: ["Clues come first; evidence backs up your answer at the end."],
          explanation: "Notice actions and words, think about what they show, pick a trait, then back it up with evidence.",
        }),
        mc("omar-change", {
          prompt: "At the start of the story, Omar refuses to try the diving board. At the end, he jumps and grins. How do his feelings change?",
          choices: ["From afraid to proud", "From proud to afraid", "From bored to angry", "They don't change"],
          correct: 0,
          difficulty: 0.4,
          hints: ["Why might someone refuse to try a diving board?", "What does a grin show?"],
          explanation: "Refusing suggests he was afraid; jumping and grinning at the end shows he feels proud.",
        }),
      ],
    },
  ],
};

const thinkingLikeADetective: SeedUnit = {
  title: "Thinking like a detective",
  summary: "Read between the lines and sort facts from opinions.",
  skills: [
    {
      code: "RD.5",
      name: "Making inferences",
      prerequisites: ["RD.1", "RD.4"],
      lessons: [
        {
          slug: "read-between-the-lines",
          title: "Read between the lines",
          level: 3,
          estimatedMinutes: 8,
          blocks: [
            { kind: "heading", text: "Clues + what you know" },
            {
              kind: "paragraph",
              text: "An inference is a smart guess based on clues in the text plus what you already know. Detectives do it all the time: muddy boots and a wet umbrella mean someone just came in from the rain.",
            },
            { kind: "callout", tone: "tip", text: "Text clues + what I know = inference." },
            {
              kind: "example",
              prompt: "“Grandpa squinted at the menu, patted his shirt pocket, then sighed.” What can you infer?",
              steps: [
                "Clue: he squinted at small print.",
                "Clue: he patted his pocket, looking for something.",
                "What I know: people often keep reading glasses in a shirt pocket.",
              ],
              answer: "Grandpa forgot his reading glasses.",
            },
            { kind: "check", item: "hungry" },
            { kind: "check", item: "pool" },
          ],
        },
      ],
      items: [
        mc("hungry", {
          prompt: "“Sam's stomach growled loudly. He kept looking at the clock and then at the lunchroom door.” What can you infer?",
          choices: ["Sam is hungry and waiting for lunch", "Sam is late for the bus", "Sam is sick", "Sam is reading a book"],
          correct: 0,
          difficulty: -0.8,
          hints: ["Why does a stomach growl?", "Why would he watch the lunchroom door?"],
          explanation: "A growling stomach plus watching the clock and the lunchroom door suggest Sam is hungry and waiting for lunch.",
        }),
        mc("rainy", {
          prompt: "“People came in shaking off their umbrellas and stamping their wet boots on the mat.” What is the weather like outside?",
          choices: ["Rainy", "Sunny", "Windy but dry", "Foggy"],
          correct: 0,
          difficulty: -1.2,
          hints: ["Why would boots be wet?"],
          explanation: "Wet umbrellas and wet boots are clues that it's raining.",
        }),
        text("pool", {
          prompt: "“The air smelled of chlorine. Kids in goggles splashed, and a whistle blew from the tall chair.” Where is this happening? (One or two words.)",
          accept: ["pool", "swimming pool", "at the pool", "public pool"],
          difficulty: 0.0,
          hints: ["Where do you smell chlorine and wear goggles?", "Who sits in a tall chair with a whistle?"],
          explanation: "Chlorine, goggles, splashing and a lifeguard's whistle all point to a swimming pool.",
        }),
        mc("ruby-feeling", {
          prompt: "“When the winner was announced, Ruby's shoulders slumped. She folded her poster and quietly put it in her bag.” How does Ruby probably feel?",
          choices: ["Disappointed", "Excited", "Angry at her friend", "Sleepy"],
          correct: 0,
          difficulty: 0.3,
          hints: ["What do slumped shoulders usually mean?", "Was Ruby the winner?"],
          explanation: "Slumped shoulders and quietly putting her poster away suggest Ruby didn't win and feels disappointed.",
        }),
        order("inference-steps", {
          prompt: "Put the inference steps in order.",
          steps: [
            "Read carefully and notice clues",
            "Think about what you already know",
            "Combine the clues with what you know",
            "Make your inference and check it against the text",
          ],
          difficulty: 0.1,
          hints: ["Clues + what I know = inference."],
          explanation: "Notice the clues, recall what you know, combine them, then make and check your inference.",
        }),
        num("birthday", {
          prompt: "“Mom set the cake on the table. There was one candle for each year — and Dev counted eight of them, plus one extra for good luck.” How old is Dev turning?",
          answer: 8,
          difficulty: 1.0,
          hints: ["Not every candle stands for a year.", "Which candle is just for luck?"],
          explanation: "There is one candle per year — eight — plus one for luck, so Dev is turning 8.",
        }),
        mc("best-evidence", {
          prompt: "“Kenji's soccer jersey was covered in grass stains, and he was grinning from ear to ear.” Which inference is best supported?",
          choices: [
            "Kenji just played a game he enjoyed",
            "Kenji lost his jersey",
            "Kenji doesn't like soccer",
            "Kenji is about to go to bed",
          ],
          correct: 0,
          difficulty: 0.6,
          hints: ["Grass stains come from…?", "A big grin shows…?"],
          explanation: "Grass stains suggest he just played, and the big grin suggests he enjoyed it.",
        }),
      ],
    },
    {
      code: "RD.6",
      name: "Fact and opinion",
      prerequisites: ["RD.1"],
      lessons: [
        {
          slug: "fact-or-opinion",
          title: "Fact or opinion?",
          level: 2,
          estimatedMinutes: 6,
          blocks: [
            { kind: "heading", text: "Can it be proven?" },
            {
              kind: "paragraph",
              text: "A fact can be proven true — you could check it in a book, measure it or observe it. An opinion tells what someone thinks or feels, and people can disagree about it.",
            },
            { kind: "callout", tone: "tip", text: "Opinion clue words: best, worst, beautiful, should, I think, delicious, boring." },
            {
              kind: "example",
              prompt: "“Blue whales are the largest animals on Earth. They are the most amazing creatures in the ocean.”",
              steps: [
                "Can the first sentence be checked? Yes — scientists have measured them. It's a fact.",
                "Could someone disagree with “most amazing”? Yes. It's an opinion.",
              ],
              answer: "Fact, then opinion",
            },
            { kind: "check", item: "which-fact" },
            { kind: "check", item: "which-opinion" },
          ],
        },
      ],
      items: [
        mc("which-fact", {
          prompt: "Which sentence is a FACT?",
          choices: ["Water freezes at 0°C.", "Winter is the best season.", "Snow is beautiful.", "Everyone should love ice skating."],
          correct: 0,
          difficulty: -1.1,
          hints: ["Which sentence could you test with a thermometer?"],
          explanation: "The freezing point of water can be measured, so it's a fact. The others are what someone thinks.",
        }),
        mc("which-opinion", {
          prompt: "Which sentence is an OPINION?",
          choices: ["Pizza is the most delicious food.", "Pizza was first made in Italy.", "A pizza is usually round.", "Pizza ovens can be very hot."],
          correct: 0,
          difficulty: -0.9,
          hints: ["Look for a clue word like “best” or “delicious”."],
          explanation: "“Most delicious” is a judgment people can disagree about, so it's an opinion.",
        }),
        text("pacific", {
          prompt: "“The Pacific is the largest ocean on Earth.” Is this a fact or an opinion?",
          accept: ["fact", "a fact"],
          difficulty: -0.6,
          hints: ["Could you check this on a map or in an atlas?"],
          explanation: "The size of oceans can be measured and checked, so it's a fact.",
        }),
        num("count-opinions", {
          prompt: "How many of these sentences are opinions? (1) Dogs are better pets than cats. (2) A spider has eight legs. (3) Math is the most fun subject. (4) The sun is a star.",
          answer: 2,
          difficulty: 0.4,
          hints: ["Look for words like “better” and “most fun”."],
          explanation: "Sentences 1 and 3 are opinions (“better”, “most fun”). Sentences 2 and 4 can be proven.",
        }),
        order("fact-check-steps", {
          prompt: "Put the steps for checking a statement in order.",
          steps: ["Read the statement", "Look for opinion clue words", "Ask: could this be proven?", "Decide: fact or opinion"],
          difficulty: 0.0,
          hints: ["Deciding is the last step."],
          explanation: "Read it, look for clue words, ask whether it could be proven, then decide.",
        }),
        mc("opinion-signal", {
          prompt: "Which word is a clue that a sentence might be an opinion?",
          choices: ["best", "measured", "is", "eight"],
          correct: 0,
          difficulty: -0.4,
          hints: ["Which word is a judgment?"],
          explanation: "“Best” is a judgment word, so it often signals an opinion.",
        }),
        mc("mixed-sentence", {
          prompt: "“Our town library has 12,000 books, and it is the coziest place to read.” Which part is an opinion?",
          choices: ["it is the coziest place to read", "Our town library", "has 12,000 books", "to read"],
          correct: 0,
          difficulty: 0.9,
          hints: ["A sentence can mix facts and opinions.", "Which part could someone disagree with?"],
          explanation: "The number of books can be counted (fact), but “coziest place to read” is a feeling (opinion).",
        }),
      ],
    },
  ],
};

export const readingDetectives: SeedCourse = {
  slug: "reading-detectives",
  title: "Reading Detectives",
  subject: "reading",
  gradeBand: "3-5",
  description:
    "Crack the case of every story: find main ideas, decode new words, follow the sequence, read characters and make inferences backed by evidence.",
  coverHue: 14,
  position: 3,
  units: [cluesInTheText, storyElements, thinkingLikeADetective],
};
