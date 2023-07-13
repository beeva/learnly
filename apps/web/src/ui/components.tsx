import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Link, type LinkProps } from "react-router-dom";
import styles from "./components.module.css";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon, type IconComponent } from "./icons";

/** Join class names, skipping falsy values. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger";

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  leadingIcon?: IconComponent;
  trailingIcon?: IconComponent;
}

function buttonClass({ variant = "primary", size = "md", block }: ButtonStyleProps, extra?: string) {
  return cx(styles.button, styles[variant], styles[size], block && styles.block, extra);
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size = "md", block, loading, leadingIcon: Leading, trailingIcon: Trailing, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={ICON_SIZE[size]} /> : Leading ? <Leading size={ICON_SIZE[size]} /> : null}
      <span className={styles.buttonLabel}>{children}</span>
      {Trailing && !loading ? <Trailing size={ICON_SIZE[size]} className={styles.trailingIcon} /> : null}
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps, ButtonStyleProps {}

/** A router link that looks like a button — for navigation, never for actions. */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant, size = "md", block, leadingIcon: Leading, trailingIcon: Trailing, className, children, ...rest },
  ref,
) {
  return (
    <Link ref={ref} className={buttonClass({ variant, size, block }, className)} {...rest}>
      {Leading ? <Leading size={ICON_SIZE[size]} /> : null}
      <span className={styles.buttonLabel}>{children}</span>
      {Trailing ? <Trailing size={ICON_SIZE[size]} className={styles.trailingIcon} /> : null}
    </Link>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconComponent;
  /** Accessible name — icon buttons must always have one. */
  label: string;
  size?: ButtonSize;
  variant?: "ghost" | "secondary";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = "md", variant = "ghost", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(styles.iconButton, styles[`icon-${size}`], variant === "secondary" && styles.iconSecondary, className)}
      {...rest}
    >
      <Icon size={ICON_SIZE[size] + 2} />
    </button>
  );
});

export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <span className={styles.spinner} style={{ width: size, height: size }} role={label ? "status" : undefined}>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

/* -------------------------------------------------------------------- Card */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article" | "li";
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
  tone?: "default" | "sunken" | "primary" | "accent";
}

export function Card({ as: Tag = "div", padding = "md", interactive, tone = "default", className, ...rest }: CardProps) {
  const Element = Tag as "div";
  return (
    <Element
      className={cx(styles.card, styles[`pad-${padding}`], interactive && styles.interactive, tone !== "default" && styles[`card-${tone}`], className)}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------ Form fields */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: IconComponent;
  /** Content rendered inside the field on the right, e.g. a show-password toggle. */
  trailing?: ReactNode;
  inputSize?: "md" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leadingIcon: Leading, trailing, inputSize = "md", className, ...rest },
  ref,
) {
  return (
    <div className={cx(styles.inputWrap, inputSize === "lg" && styles.inputLg, rest["aria-invalid"] && styles.inputInvalid, className)}>
      {Leading ? <Leading size={18} className={styles.inputIcon} /> : null}
      <input ref={ref} className={styles.input} {...rest} />
      {trailing ? <div className={styles.inputTrailing}>{trailing}</div> : null}
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className={cx(styles.inputWrap, styles.selectWrap, className)}>
      <select ref={ref} className={cx(styles.input, styles.select)} {...rest}>
        {children}
      </select>
    </div>
  );
});

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** A friendly, specific message. Shown instead of the hint when present. */
  error?: string | null;
  required?: boolean;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Wires a label, hint and error message to a single control through ids, so
 * screen readers announce "Email, invalid entry, Check the address…" together.
 */
export function Field({ label, hint, error, required, hideLabel, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = cx(error ? errorId : null, hint ? hintId : null) || undefined;
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={cx(styles.label, hideLabel && "sr-only")}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, "aria-required": required || undefined })}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="error"
            id={errorId}
            className={styles.error}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <AlertIcon size={14} />
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export interface ChoiceOption<V extends string> {
  value: V;
  label: ReactNode;
  description?: ReactNode;
  icon?: IconComponent;
}

export interface ChoiceGroupProps<V extends string> {
  legend: ReactNode;
  hideLegend?: boolean;
  name: string;
  value: V | null;
  options: ChoiceOption<V>[];
  onChange: (value: V) => void;
  columns?: 2 | 3 | 4 | 5;
  size?: "sm" | "md";
  error?: string | null;
}

/** Large tappable radio cards (role picker, grade band, daily goal). Native radios keep arrow-key support. */
export function ChoiceGroup<V extends string>({ legend, hideLegend, name, value, options, onChange, columns = 2, size = "md", error }: ChoiceGroupProps<V>) {
  const errorId = useId();
  return (
    <fieldset className={styles.choiceGroup} aria-describedby={error ? errorId : undefined}>
      <legend className={cx(styles.label, hideLegend && "sr-only")}>{legend}</legend>
      <div className={cx(styles.choiceGrid, styles[`cols-${columns}`])}>
        {options.map((option) => {
          const checked = option.value === value;
          const Icon = option.icon;
          return (
            <label key={option.value} className={cx(styles.choice, size === "sm" && styles.choiceSm, checked && styles.choiceChecked)}>
              <input
                type="radio"
                className={styles.choiceInput}
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
              />
              {Icon ? (
                <span className={styles.choiceIcon}>
                  <Icon size={22} />
                </span>
              ) : null}
              <span className={styles.choiceText}>
                <span className={styles.choiceLabel}>{option.label}</span>
                {option.description ? <span className={styles.choiceDescription}>{option.description}</span> : null}
              </span>
              <span className={styles.choiceCheck} aria-hidden="true">
                <CheckIcon size={14} />
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className={styles.error}>
          <AlertIcon size={14} />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className={styles.switchRow}>
      <div className={styles.switchText}>
        <label htmlFor={id} className={styles.switchLabel}>
          {label}
        </label>
        {description ? (
          <p id={`${id}-desc`} className={styles.hint}>
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        className={cx(styles.switch, checked && styles.switchOn)}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.switchThumb} />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------- Badge, Avatar */

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: IconComponent;
  size?: "sm" | "md";
}

export function Badge({ tone = "neutral", icon: Icon, size = "md", className, children, ...rest }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[`badge-${tone}`], size === "sm" && styles.badgeSm, className)} {...rest}>
      {Icon ? <Icon size={size === "sm" ? 12 : 14} /> : null}
      {children}
    </span>
  );
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

export interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, color = "#5B5BD6", size = 40, className }: AvatarProps) {
  return (
    <span
      className={cx(styles.avatar, className)}
      style={{ "--avatar-color": color, width: size, height: size, fontSize: Math.round(size * 0.4) } as CSSProperties}
      role="img"
      aria-label={name}
    >
      <span aria-hidden="true">{initialsOf(name)}</span>
    </span>
  );
}

/* ------------------------------------------------------ Progress visuals */

const TONE_VAR: Record<Tone, string> = {
  neutral: "var(--color-text-subtle)",
  primary: "var(--color-primary)",
  accent: "var(--color-accent)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
};

export interface ProgressRingProps {
  /** 0..1 */
  value: number;
  size?: number;
  thickness?: number;
  tone?: Tone;
  /** Accessible description, e.g. "Level 4, 60% to level 5". */
  label: string;
  children?: ReactNode;
  className?: string;
}

export function ProgressRing({ value, size = 96, thickness = 10, tone = "primary", label, children, className }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      className={cx(styles.ring, className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={thickness} className={styles.ringTrack} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={thickness}
          fill="none"
          stroke={TONE_VAR[tone]}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children ? <div className={styles.ringCenter}>{children}</div> : null}
    </div>
  );
}

export interface ProgressBarProps {
  value: number;
  tone?: Tone;
  label: string;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({ value, tone = "primary", label, showLabel, size = "md", className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className={cx(styles.barWrap, className)}>
      {showLabel ? (
        <div className={styles.barLabel}>
          <span>{label}</span>
          <span className="tabular">{Math.round(clamped * 100)}%</span>
        </div>
      ) : null}
      <div
        className={cx(styles.bar, size === "sm" && styles.barSm)}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
      >
        <motion.div
          className={styles.barFill}
          style={{ background: TONE_VAR[tone] }}
          initial={{ width: 0 }}
          animate={{ width: `${clamped * 100}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  lines?: number;
  className?: string;
}

/** Shimmering placeholder. Decorative — pair it with an aria-busy container. */
export function Skeleton({ width = "100%", height = 16, radius = 8, lines, className }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={styles.skeletonLines} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className={cx(styles.skeleton, className)} style={{ width: i === lines - 1 ? "62%" : width, height, borderRadius: radius }} />
        ))}
      </div>
    );
  }
  return <span aria-hidden="true" className={cx(styles.skeleton, className)} style={{ width, height, borderRadius: radius }} />;
}

/* ------------------------------------------------------- Banner, Empty */

const TONE_ICON: Partial<Record<Tone, IconComponent>> = {
  primary: InfoIcon,
  neutral: InfoIcon,
  success: CheckIcon,
  warning: AlertIcon,
  danger: AlertIcon,
};

export interface BannerProps {
  tone?: Tone;
  icon?: IconComponent;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
  role?: "status" | "alert";
}

export function Banner({ tone = "primary", icon, title, children, action, onDismiss, className, role }: BannerProps) {
  const Icon = icon ?? TONE_ICON[tone] ?? InfoIcon;
  return (
    <div className={cx(styles.banner, styles[`banner-${tone}`], className)} role={role}>
      <span className={styles.bannerIcon}>
        <Icon size={20} />
      </span>
      <div className={styles.bannerBody}>
        {title ? <p className={styles.bannerTitle}>{title}</p> : null}
        {children ? <div className={styles.bannerText}>{children}</div> : null}
      </div>
      {action ? <div className={styles.bannerAction}>{action}</div> : null}
      {onDismiss ? <IconButton icon={CloseIcon} label="Dismiss" size="sm" onClick={onDismiss} /> : null}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: IconComponent;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, compact && styles.emptyCompact)}>
      {Icon ? (
        <div className={styles.emptyArt} aria-hidden="true">
          <span className={styles.emptyBlob} />
          <Icon size={compact ? 28 : 36} />
        </div>
      ) : null}
      <h2 className={styles.emptyTitle}>{title}</h2>
      {description ? <p className={styles.emptyDescription}>{description}</p> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Toast */

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  icon?: IconComponent;
  durationMs?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...options, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), options.durationMs ?? 4500),
      );
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className={styles.toaster} role="region" aria-label="Notifications">
          <ol role="list" className={styles.toastList} aria-live="polite" aria-relevant="additions">
            <AnimatePresence initial={false}>
              {toasts.map((t) => {
                const Icon = t.icon ?? (t.tone === "success" ? CheckIcon : t.tone === "danger" || t.tone === "warning" ? AlertIcon : InfoIcon);
                return (
                  <motion.li
                    key={t.id}
                    layout
                    className={cx(styles.toast, styles[`toast-${t.tone ?? "neutral"}`])}
                    initial={{ opacity: 0, y: 16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  >
                    <span className={styles.toastIcon}>
                      <Icon size={18} />
                    </span>
                    <div className={styles.toastBody}>
                      <p className={styles.toastTitle}>{t.title}</p>
                      {t.description ? <p className={styles.toastDescription}>{t.description}</p> : null}
                    </div>
                    <IconButton icon={CloseIcon} label="Dismiss notification" size="sm" onClick={() => dismiss(t.id)} />
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

/* ----------------------------------------------------------------- Dialog */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md";
  /** Element to focus first; defaults to the first focusable control. */
  initialFocusRef?: RefObject<HTMLElement>;
}

/**
 * Modal dialog: traps focus, closes on Escape or backdrop click, locks page
 * scroll and returns focus to whatever opened it.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", initialFocusRef }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const target = initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, initialFocusRef]);

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={styles.dialogBackdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            className={cx(styles.dialog, size === "sm" && styles.dialogSm)}
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <header className={styles.dialogHeader}>
              <div>
                <h2 id={titleId} className={styles.dialogTitle}>
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className={styles.dialogDescription}>
                    {description}
                  </p>
                ) : null}
              </div>
              <IconButton icon={CloseIcon} label="Close dialog" onClick={onClose} />
            </header>
            {children ? <div className={styles.dialogBody}>{children}</div> : null}
            {footer ? <footer className={styles.dialogFooter}>{footer}</footer> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

