import { joinClassroomSchema, type Classroom } from "@learnly/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { isApiError } from "../../api/client";
import { useClassrooms, useCourses, useJoinClassroom } from "../../api/hooks";
import { useT } from "../../i18n/I18nProvider";
import { Badge, Banner, Button, ButtonLink, Card, cx } from "../../ui/components";
import { ArrowRightIcon, CheckIcon, GraduationCapIcon, HomeIcon, UsersIcon } from "../../ui/icons";
import styles from "./JoinClassroom.module.css";

const CODE_LENGTH = 6;
const showDemo = import.meta.env.MODE === "mock" || import.meta.env.VITE_USE_MOCKS === "true";

/** Keep only characters a join code can contain; I, O, 0 and 1 are excluded to avoid mix-ups. */
export function sanitizeJoinCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

export function JoinClassroomPage() {
  const { t } = useT();
  const join = useJoinClassroom();
  const classrooms = useClassrooms();
  const courses = useCourses();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<Classroom | null>(null);

  const course = joined ? courses.data?.courses.find((candidate) => candidate.id === joined.courseId) : undefined;
  const myClasses = classrooms.data?.classrooms ?? [];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = joinClassroomSchema.safeParse({ joinCode: code });
    if (!parsed.success) {
      setError(code.length < CODE_LENGTH ? t("classroom.join.tooShort", { count: CODE_LENGTH }) : t("classroom.join.invalid"));
      inputRef.current?.focus();
      return;
    }
    setError(null);
    try {
      const { classroom } = await join.mutateAsync(parsed.data.joinCode);
      setJoined(classroom);
      void classrooms.refetch();
    } catch (failure) {
      setError(
        isApiError(failure, "not_found")
          ? t("classroom.join.notFound")
          : isApiError(failure, "conflict")
            ? t("classroom.join.already")
            : isApiError(failure, "network")
              ? t("classroom.join.offline")
              : t("classroom.join.failed"),
      );
      inputRef.current?.focus();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    setCode(sanitizeJoinCode(event.clipboardData.getData("text")));
    setError(null);
  }

  return (
    <div className={styles.page}>
      <AnimatePresence mode="wait">
        {joined ? (
          <motion.div key="joined" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
            <Card padding="lg" className={styles.success}>
              <motion.span
                className={styles.successIcon}
                initial={{ scale: 0.4, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.1 }}
                aria-hidden="true"
              >
                <CheckIcon size={36} />
              </motion.span>
              <p className="eyebrow">{t("classroom.success.eyebrow")}</p>
              <h1 className={styles.successTitle} role="status">
                {t("classroom.success.title", { name: joined.name })}
              </h1>
              <p className={styles.successBody}>
                {course ? t("classroom.success.bodyCourse", { course: course.title }) : t("classroom.success.body")}
              </p>
              <div className={styles.successActions}>
                <ButtonLink to="/home" size="lg" leadingIcon={HomeIcon}>
                  {t("classroom.success.home")}
                </ButtonLink>
                {course ? (
                  <ButtonLink to={`/courses/${course.slug}`} size="lg" variant="secondary" trailingIcon={ArrowRightIcon}>
                    {t("classroom.success.course")}
                  </ButtonLink>
                ) : null}
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card padding="lg" className={styles.card}>
              <span className={styles.icon} aria-hidden="true">
                <GraduationCapIcon size={30} />
              </span>
              <h1 className={styles.title}>{t("classroom.join.title")}</h1>
              <p className={styles.lead}>{t("classroom.join.lead")}</p>

              <form className={styles.form} onSubmit={(event) => void onSubmit(event)} noValidate>
                <label htmlFor="join-code" className="sr-only">
                  {t("classroom.join.label")}
                </label>
                <div className={styles.codeField}>
                  <input
                    ref={inputRef}
                    id="join-code"
                    className={cx(styles.codeInput, error && styles.codeInputInvalid)}
                    value={code}
                    onChange={(event) => {
                      setCode(sanitizeJoinCode(event.target.value));
                      setError(null);
                    }}
                    onPaste={onPaste}
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                    maxLength={CODE_LENGTH}
                    placeholder="ABC123"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "join-code-error" : "join-code-hint"}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                  <div className={styles.slots} aria-hidden="true">
                    {Array.from({ length: CODE_LENGTH }, (_, i) => (
                      <span key={i} className={cx(styles.slot, i < code.length && styles.slotFilled, i === code.length && styles.slotCurrent)} />
                    ))}
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {error ? (
                    <motion.p
                      key="error"
                      id="join-code-error"
                      className={styles.error}
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      {error}
                    </motion.p>
                  ) : (
                    <p id="join-code-hint" className={styles.hint}>
                      {t("classroom.join.hint")}
                    </p>
                  )}
                </AnimatePresence>
                <Button type="submit" size="lg" block loading={join.isPending} disabled={code.length === 0} trailingIcon={ArrowRightIcon}>
                  {t("classroom.join.submit")}
                </Button>
              </form>

              {showDemo ? (
                <Banner tone="primary" className={styles.demo}>
                  {t("classroom.join.demo", { code: "FRAC24" })}
                </Banner>
              ) : null}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {myClasses.length > 0 ? (
        <section className={styles.mine} aria-labelledby="my-classes">
          <h2 id="my-classes" className={styles.mineTitle}>
            {t("classroom.mine.title")}
          </h2>
          <ul role="list" className={styles.mineList}>
            {myClasses.map((classroom) => (
              <li key={classroom.id} className={styles.mineItem}>
                <span className={styles.mineIcon} aria-hidden="true">
                  <UsersIcon size={18} />
                </span>
                <span className={styles.mineName}>{classroom.name}</span>
                <Badge size="sm">{courses.data?.courses.find((c) => c.id === classroom.courseId)?.title ?? ""}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
