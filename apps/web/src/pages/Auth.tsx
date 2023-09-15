import { GRADE_BANDS, signInSchema, signUpSchema, type GradeBand } from "@learnly/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { isApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { Banner, Button, ChoiceGroup, Field, IconButton, Input, cx, type FieldControlProps } from "../ui/components";
import {
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  FlameIcon,
  GraduationCapIcon,
  LockIcon,
  LogoMark,
  MailIcon,
  SparklesIcon,
  UserIcon,
} from "../ui/icons";
import styles from "./Auth.module.css";

const DEMO_ACCOUNTS = {
  student: { email: "maya@learnly.app", password: "learnly-demo-1" },
  educator: { email: "rivera@learnly.app", password: "learnly-demo-1" },
} as const;

const showDemo = import.meta.env.MODE === "mock" || import.meta.env.VITE_USE_MOCKS === "true";

export const GRADE_BAND_LABEL: Record<GradeBand, string> = {
  "k-2": "Grades K–2",
  "3-5": "Grades 3–5",
  "6-8": "Grades 6–8",
  "9-12": "Grades 9–12",
};

const GRADE_BAND_HINT: Record<GradeBand, string> = {
  "k-2": "Ages 5–8",
  "3-5": "Ages 8–11",
  "6-8": "Ages 11–14",
  "9-12": "Ages 14–18",
};

/** Turn validator wording into something a 9-year-old (or their teacher) can act on. */
function friendlyMessage(field: string, message: string): string {
  if (field === "email") return "That email doesn't look quite right — check for typos.";
  if (field === "displayName") return "Tell us what to call you.";
  if (field === "password" && message.toLowerCase().includes("required")) return "Choose a password.";
  return message;
}

function useRedirectTarget() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return from && from.startsWith("/") && !from.startsWith("//") ? from : "/home";
}

/* ---------------------------------------------------------------- layout */

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className={styles.layout}>
      <aside className={styles.brandPanel} aria-hidden="true">
        <Link to="/" className={styles.brand} tabIndex={-1}>
          <LogoMark size={40} />
          <span>Learnly</span>
        </Link>
        <div className={styles.brandArt}>
          <div className={styles.orbit}>
            <span className={cx(styles.orbitChip, styles.chipA)}>
              <FlameIcon size={16} /> 7-day streak
            </span>
            <span className={cx(styles.orbitChip, styles.chipB)}>
              <SparklesIcon size={16} /> Nice work using that hint.
            </span>
            <span className={cx(styles.orbitChip, styles.chipC)}>
              <CheckIcon size={16} /> Equivalent fractions mastered
            </span>
          </div>
        </div>
        <div className={styles.brandCopy}>
          <p className={styles.brandQuote}>Every student starts somewhere. Learnly meets them there.</p>
          <p className={styles.brandSub}>Short lessons, smart practice and progress you can see.</p>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className={styles.formPanel}>
        <Link to="/" className={styles.mobileBrand}>
          <LogoMark size={32} />
          <span>Learnly</span>
        </Link>
        <motion.div className={styles.formCard} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
          <header className={styles.formHeader}>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </header>
          {children}
        </motion.div>
        <p className={styles.switchLink}>{footer}</p>
      </main>
    </div>
  );
}

function PasswordInput(props: { value: string; onChange: (value: string) => void; autoComplete: string; control: FieldControlProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props.control}
      type={visible ? "text" : "password"}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      autoComplete={props.autoComplete}
      leadingIcon={LockIcon}
      trailing={
        <IconButton
          icon={visible ? EyeOffIcon : EyeIcon}
          label={visible ? "Hide password" : "Show password"}
          size="sm"
          onClick={() => setVisible((v) => !v)}
        />
      }
    />
  );
}

/** 0..4 — length and variety, mirroring what the API will actually accept. */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password) || /[A-Z]/.test(password)) score += 1;
  return score;
}

const STRENGTH_LABEL = ["Too short", "Getting there", "Okay", "Strong", "Super strong"];

function StrengthMeter({ password }: { password: string }) {
  const score = passwordStrength(password);
  if (!password) return null;
  return (
    <div className={styles.strength} aria-live="polite">
      <div className={styles.strengthBars} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx(styles.strengthBar, i < score && styles[`strength-${score}`])} />
        ))}
      </div>
      <span className={styles.strengthLabel}>Password strength: {STRENGTH_LABEL[score]}</span>
    </div>
  );
}

/* --------------------------------------------------------------- sign in */

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const target = useRedirectTarget();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: { email: string; password: string }) {
    setFormError(null);
    const parsed = signInSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        ...(fieldErrors.email ? { email: friendlyMessage("email", fieldErrors.email[0] ?? "") } : {}),
        ...(fieldErrors.password ? { password: "Enter your password." } : {}),
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await signIn(parsed.data);
      navigate(target, { replace: true });
    } catch (error) {
      setFormError(
        isApiError(error, "unauthorized")
          ? "That email and password don't match. Want to try again?"
          : isApiError(error, "rate_limited")
            ? "Too many tries in a row. Take a short break and try again in a minute."
            : isApiError(error)
              ? error.message
              : "Something went wrong on our side. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit({ email, password });
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Pick up right where you left off."
      footer={
        <>
          New to Learnly? <Link to="/sign-up">Create an account</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <AnimatePresence>
          {formError ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Banner tone="danger" role="alert">
                {formError}
              </Banner>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <Field label="Email" error={errors.email}>
          {(control) => (
            <Input {...control} type="email" autoComplete="email" inputMode="email" leadingIcon={MailIcon} value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(control) => <PasswordInput control={control} value={password} onChange={setPassword} autoComplete="current-password" />}
        </Field>
        <Button type="submit" size="lg" block loading={submitting} trailingIcon={ArrowRightIcon}>
          Sign in
        </Button>
        {showDemo ? (
          <div className={styles.demo}>
            <span>Exploring the demo?</span>
            <div className={styles.demoButtons}>
              {(["student", "educator"] as const).map((role) => (
                <Button
                  key={role}
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => {
                    setEmail(DEMO_ACCOUNTS[role].email);
                    setPassword(DEMO_ACCOUNTS[role].password);
                    void submit(DEMO_ACCOUNTS[role]);
                  }}
                >
                  Continue as demo {role}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </AuthLayout>
  );
}

/* --------------------------------------------------------------- sign up */

type SignUpRole = "student" | "educator";

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<SignUpRole>(params.get("role") === "educator" ? "educator" : "student");
  const [gradeBand, setGradeBand] = useState<GradeBand | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = signUpSchema.safeParse({ email, password, displayName, role, gradeBand: role === "student" ? gradeBand : null });
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
        const first = messages?.[0];
        if (first) next[field] = friendlyMessage(field, first);
      }
    }
    if (role === "student" && !gradeBand) next.gradeBand = "Pick a grade band so lessons start at the right level.";
    setErrors(next);
    if (!parsed.success || Object.keys(next).length > 0) {
      const firstInvalid = document.querySelector<HTMLElement>("[aria-invalid='true'], fieldset[aria-describedby] input");
      firstInvalid?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await signUp(parsed.data);
      navigate("/home", { replace: true });
    } catch (error) {
      if (isApiError(error, "conflict")) {
        setErrors({ email: "There's already an account with this email. Try signing in instead." });
      } else if (isApiError(error, "validation_failed")) {
        const fields = error.fieldErrors;
        setErrors(Object.fromEntries(Object.entries(fields).map(([field, message]) => [field, friendlyMessage(field, message)])));
      } else {
        setFormError(isApiError(error) ? error.message : "Something went wrong on our side. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes less than a minute. No credit card, ever."
      footer={
        <>
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {formError ? (
          <Banner tone="danger" role="alert">
            {formError}
          </Banner>
        ) : null}

        <ChoiceGroup<SignUpRole>
          legend="I'm joining as"
          name="role"
          value={role}
          onChange={setRole}
          options={[
            { value: "student", label: "A student", description: "Learn at my own pace", icon: SparklesIcon },
            { value: "educator", label: "An educator", description: "Guide a class", icon: GraduationCapIcon },
          ]}
        />

        <AnimatePresence initial={false}>
          {role === "student" ? (
            <motion.div
              key="grade"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: "hidden" }}
            >
              <ChoiceGroup<GradeBand>
                legend="Grade band"
                name="gradeBand"
                value={gradeBand}
                onChange={setGradeBand}
                columns={4}
                size="sm"
                error={errors.gradeBand}
                options={GRADE_BANDS.map((band) => ({ value: band, label: GRADE_BAND_LABEL[band], description: GRADE_BAND_HINT[band] }))}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Field label={role === "student" ? "What should we call you?" : "Your name"} hint="This is what you'll see on your dashboard." error={errors.displayName}>
          {(control) => (
            <Input {...control} autoComplete="name" leadingIcon={UserIcon} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
          )}
        </Field>
        <Field label="Email" error={errors.email}>
          {(control) => (
            <Input {...control} type="email" autoComplete="email" inputMode="email" leadingIcon={MailIcon} value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field label="Password" hint="At least 10 characters, with letters and numbers." error={errors.password}>
          {(control) => <PasswordInput control={control} value={password} onChange={setPassword} autoComplete="new-password" />}
        </Field>
        <StrengthMeter password={password} />

        <Button type="submit" size="lg" block loading={submitting} trailingIcon={ArrowRightIcon}>
          {role === "student" ? "Start learning" : "Create educator account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
