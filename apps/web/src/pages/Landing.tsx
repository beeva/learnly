import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ButtonLink, cx } from "../ui/components";
import {
  ArrowRightIcon,
  BoltIcon,
  ChartIcon,
  CheckIcon,
  CloudOffIcon,
  CompassIcon,
  FlameIcon,
  HeartIcon,
  LayersIcon,
  LogoMark,
  SparklesIcon,
  StarIcon,
  TargetIcon,
  type IconComponent,
} from "../ui/icons";
import styles from "./Landing.module.css";

const STEPS: { icon: IconComponent; title: string; body: string; tone: string }[] = [
  {
    icon: CompassIcon,
    title: "Assess",
    body: "A short, calm check-in finds each student's starting point. No scores, no pressure — just where to begin.",
    tone: "indigo",
  },
  {
    icon: LayersIcon,
    title: "Learn",
    body: "Lessons arrive one idea at a time, with worked examples you reveal step by step at your own pace.",
    tone: "coral",
  },
  {
    icon: TargetIcon,
    title: "Practice",
    body: "Every question is picked for what you need next — challenging enough to grow, never enough to overwhelm.",
    tone: "mint",
  },
  {
    icon: ChartIcon,
    title: "Progress",
    body: "Streaks, mastery rings and XP make effort visible, so momentum builds day after day.",
    tone: "amber",
  },
];

const FEATURES: { icon: IconComponent; title: string; body: string }[] = [
  { icon: BoltIcon, title: "Adaptive pacing", body: "Moves faster when you're cruising, slows down and adds support when you're stuck." },
  { icon: TargetIcon, title: "Responsive difficulty", body: "A learning model tunes each question to keep success around three in four." },
  { icon: HeartIcon, title: "Warm, never clinical", body: "Mistakes are framed as part of learning. Feedback always explains, never scolds." },
  { icon: CloudOffIcon, title: "Works offline", body: "Lessons are saved on the device and progress syncs the moment you're back online." },
  { icon: ChartIcon, title: "Educator insights", body: "See where a class is struggling and the misconception behind it — before the test." },
  { icon: SparklesIcon, title: "Accessible by design", body: "Built to WCAG 2.2 AA with full keyboard support, captions and reduced-motion modes." },
];

const HEAT = [
  [0.92, 0.81, 0.64, 0.4, 0.22],
  [0.88, 0.9, 0.71, 0.55, 0.31],
  [0.76, 0.58, 0.35, 0.18, 0.12],
  [0.95, 0.86, 0.79, 0.66, 0.47],
  [0.67, 0.49, 0.28, 0.2, 0.1],
];

function heatColor(p: number) {
  if (p >= 0.85) return "var(--mastery-mastered)";
  if (p >= 0.6) return "var(--mastery-practicing)";
  if (p >= 0.35) return "var(--mastery-learning)";
  return "var(--mastery-new)";
}

function HeroPreview() {
  const reduce = useReducedMotion();
  const float = (delay: number) =>
    reduce ? {} : { animate: { y: [0, -8, 0] }, transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const, delay } };

  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.previewGlow} />
      <motion.div className={styles.previewCard} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
        <div className={styles.previewTop}>
          <span className={styles.previewPill}>Fractions · Equivalent fractions</span>
          <div className={styles.previewDots}>
            {[1, 1, 1, 0, 0, 0].map((done, i) => (
              <span key={i} className={cx(styles.previewDot, done === 1 && styles.previewDotDone, i === 3 && styles.previewDotCurrent)} />
            ))}
          </div>
        </div>
        <p className={styles.previewPrompt}>Which fraction is equal to</p>
        <div className={styles.previewFraction}>
          <span>2</span>
          <span className={styles.previewBar} />
          <span>4</span>
        </div>
        <div className={styles.previewChoices}>
          {["1/3", "1/2", "3/4", "2/8"].map((choice) => (
            <span key={choice} className={cx(styles.previewChoice, choice === "1/2" && styles.previewChoiceRight)}>
              {choice === "1/2" ? <CheckIcon size={16} /> : null}
              {choice}
            </span>
          ))}
        </div>
        <div className={styles.previewFeedback}>
          <span className={styles.previewFeedbackIcon}>
            <SparklesIcon size={16} />
          </span>
          <div>
            <strong>You're on a roll — 3 in a row!</strong>
            <span>Halving both parts keeps the same amount.</span>
          </div>
        </div>
      </motion.div>

      <motion.div className={cx(styles.floatChip, styles.floatStreak)} {...float(0.4)}>
        <span className={styles.flame}>
          <FlameIcon size={18} />
        </span>
        <div>
          <strong>12 days</strong>
          <span>streak</span>
        </div>
      </motion.div>

      <motion.div className={cx(styles.floatChip, styles.floatRing)} {...float(1.2)}>
        <svg width="54" height="54" viewBox="0 0 54 54">
          <circle cx="27" cy="27" r="22" fill="none" strokeWidth="7" className={styles.ringTrack} />
          <circle cx="27" cy="27" r="22" fill="none" strokeWidth="7" stroke="var(--color-success)" strokeLinecap="round" strokeDasharray="138.2" strokeDashoffset="34" transform="rotate(-90 27 27)" />
        </svg>
        <div>
          <strong>Mastered</strong>
          <span>Simplify fractions</span>
        </div>
      </motion.div>

      <motion.div className={cx(styles.floatChip, styles.floatXp)} {...float(2)}>
        <StarIcon size={16} />
        <strong>+15 XP</strong>
      </motion.div>
    </div>
  );
}

export function LandingPage() {
  const { status } = useAuth();
  const signedIn = status === "authenticated";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={cx("container", styles.headerInner)}>
          <Link to="/" className={styles.brand} aria-label="Learnly home">
            <LogoMark size={34} />
            <span>Learnly</span>
          </Link>
          <nav aria-label="Site" className={styles.headerNav}>
            <a href="#how-it-works">How it works</a>
            <a href="#educators">For educators</a>
          </nav>
          <div className={styles.headerCtas}>
            {signedIn ? (
              <ButtonLink to="/home" size="sm" trailingIcon={ArrowRightIcon}>
                Open Learnly
              </ButtonLink>
            ) : (
              <>
                <Link to="/sign-in" className={styles.signIn}>
                  Sign in
                </Link>
                <ButtonLink to="/sign-up" size="sm">
                  Get started
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <section className={styles.hero}>
          <div className={cx("container", styles.heroInner)}>
            <div className={styles.heroCopy}>
              <motion.p className="eyebrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                Adaptive learning for grades K–12
              </motion.p>
              <motion.h1 className={styles.heroTitle} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                Learning that <span className={styles.highlight}>adapts</span> to every student.
              </motion.h1>
              <motion.p className={styles.heroLead} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                Learnly finds where each student is, paces lessons to them, and turns practice into progress they can see
                — so every learner feels capable, not left behind.
              </motion.p>
              <motion.div className={styles.heroCtas} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <ButtonLink to={signedIn ? "/home" : "/sign-up"} size="lg" trailingIcon={ArrowRightIcon}>
                  {signedIn ? "Continue learning" : "Start learning free"}
                </ButtonLink>
                <ButtonLink to="/sign-up?role=educator" size="lg" variant="secondary">
                  I'm an educator
                </ButtonLink>
              </motion.div>
              <ul role="list" className={styles.trust}>
                {["Lessons load in under 2s", "Works offline", "WCAG 2.2 AA"].map((item) => (
                  <li key={item}>
                    <CheckIcon size={16} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <HeroPreview />
          </div>
        </section>

        <section id="how-it-works" className={styles.section} aria-labelledby="how-title">
          <div className="container">
            <div className={styles.sectionHead}>
              <p className="eyebrow">How it works</p>
              <h2 id="how-title">A learning loop that meets students where they are</h2>
              <p className="muted">Four simple steps, repeated every day. Each one quietly feeds the next.</p>
            </div>
            <ol role="list" className={styles.steps}>
              {STEPS.map((step, index) => (
                <motion.li
                  key={step.title}
                  className={cx(styles.step, styles[`tone-${step.tone}`])}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className={styles.stepNumber}>0{index + 1}</span>
                  <span className={styles.stepIcon}>
                    <step.icon size={26} />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        <section className={cx(styles.section, styles.sectionAlt)} aria-labelledby="features-title">
          <div className="container">
            <div className={styles.sectionHead}>
              <p className="eyebrow">Why it works</p>
              <h2 id="features-title">Designed to lower anxiety and raise confidence</h2>
            </div>
            <ul role="list" className={styles.features}>
              {FEATURES.map((feature) => (
                <li key={feature.title} className={styles.feature}>
                  <span className={styles.featureIcon}>
                    <feature.icon size={22} />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="educators" className={styles.section} aria-labelledby="educators-title">
          <div className={cx("container", styles.educators)}>
            <div className={styles.educatorCopy}>
              <p className="eyebrow">For educators</p>
              <h2 id="educators-title">See where your class is struggling — and why</h2>
              <p className="muted">
                Class insights surface the skills with the most errors, the misconception behind them and the students who
                could use a check-in. Export everything to CSV in one click.
              </p>
              <ul role="list" className={styles.checklist}>
                {["Mastery heatmap for every student and skill", "Common misconceptions, not just error rates", "Join codes — no student emails needed"].map((item) => (
                  <li key={item}>
                    <span className={styles.check}>
                      <CheckIcon size={14} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <ButtonLink to="/sign-up?role=educator" variant="secondary" trailingIcon={ArrowRightIcon}>
                Create a classroom
              </ButtonLink>
            </div>
            <div className={styles.heatCard} aria-hidden="true">
              <div className={styles.heatHead}>
                <strong>Period 2 · Fractions</strong>
                <span>24 students</span>
              </div>
              <div className={styles.heatGrid}>
                {HEAT.flatMap((row, r) =>
                  row.map((p, c) => (
                    <motion.span
                      key={`${r}-${c}`}
                      className={styles.heatCell}
                      style={{ background: heatColor(p) }}
                      initial={{ opacity: 0, scale: 0.6 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: (r + c) * 0.04 }}
                    />
                  )),
                )}
              </div>
              <div className={styles.hotspot}>
                <span className={styles.hotspotBadge}>Hotspot</span>
                <p>
                  <strong>Add fractions with like denominators</strong>
                  <span>Common misconception: adding the denominators (1/4 + 1/4 = 2/8)</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.ctaBand}>
          <div className={cx("container", styles.ctaInner)}>
            <h2>Every student can get there. Learnly shows them the way.</h2>
            <ButtonLink to={signedIn ? "/home" : "/sign-up"} size="lg" variant="accent" trailingIcon={ArrowRightIcon}>
              {signedIn ? "Back to learning" : "Create your free account"}
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={cx("container", styles.footerInner)}>
          <span className={styles.brand}>
            <LogoMark size={24} />
            <span>Learnly</span>
          </span>
          <p className="muted">Learning that adapts to every student.</p>
        </div>
      </footer>
    </div>
  );
}
