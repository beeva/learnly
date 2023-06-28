import { forwardRef, type ReactNode, type SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /** Rendered width and height in px. Defaults to 20. */
  size?: number;
  /** When set, the icon is announced to assistive tech; otherwise it is decorative. */
  title?: string;
}

export type IconComponent = ReturnType<typeof createIcon>;

/**
 * Icons are hand-drawn on a 24px grid with a 1.75 stroke and round caps so they
 * sit comfortably next to Nunito's rounded letterforms.
 */
function createIcon(displayName: string, body: ReactNode, options: { filled?: boolean } = {}) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon({ size = 20, title, ...rest }, ref) {
    const labelled = Boolean(title);
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={options.filled ? "currentColor" : "none"}
        stroke={options.filled ? "none" : "currentColor"}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        role={labelled ? "img" : undefined}
        aria-hidden={labelled ? undefined : true}
        focusable="false"
        {...rest}
      >
        {labelled ? <title>{title}</title> : null}
        {body}
      </svg>
    );
  });
  Icon.displayName = displayName;
  return Icon;
}

export const HomeIcon = createIcon(
  "HomeIcon",
  <>
    <path d="M3.5 10.5 12 3.75l8.5 6.75" />
    <path d="M5.5 9v9.25A1.75 1.75 0 0 0 7.25 20h9.5a1.75 1.75 0 0 0 1.75-1.75V9" />
    <path d="M10 20v-5.25a2 2 0 0 1 4 0V20" />
  </>,
);

export const BookIcon = createIcon(
  "BookIcon",
  <>
    <path d="M4 5.5C6.9 4.3 9.6 4.5 12 6.2v13.3c-2.4-1.7-5.1-1.9-8-.7z" />
    <path d="M20 5.5c-2.9-1.2-5.6-1-8 .7v13.3c2.4-1.7 5.1-1.9 8-.7z" />
  </>,
);

export const CompassIcon = createIcon(
  "CompassIcon",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" />
  </>,
);

export const TargetIcon = createIcon(
  "TargetIcon",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.75" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" />
  </>,
);

export const ChartIcon = createIcon(
  "ChartIcon",
  <>
    <path d="M4 20h16" />
    <rect x="5.5" y="11" width="3" height="6" rx="1" />
    <rect x="10.5" y="7" width="3" height="10" rx="1" />
    <rect x="15.5" y="4" width="3" height="13" rx="1" />
  </>,
);

export const SettingsIcon = createIcon(
  "SettingsIcon",
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z" />
  </>,
);

export const LogOutIcon = createIcon(
  "LogOutIcon",
  <>
    <path d="M14 4.5h3.25A1.75 1.75 0 0 1 19 6.25v11.5a1.75 1.75 0 0 1-1.75 1.75H14" />
    <path d="M10 8 6 12l4 4" />
    <path d="M6 12h9" />
  </>,
);

export const SunIcon = createIcon(
  "SunIcon",
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.75v1.5M12 19.75v1.5M4.2 4.2l1.06 1.06M18.74 18.74l1.06 1.06M2.75 12h1.5M19.75 12h1.5M4.2 19.8l1.06-1.06M18.74 5.26l1.06-1.06" />
  </>,
);

export const MoonIcon = createIcon(
  "MoonIcon",
  <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z" />,
);

export const ArrowRightIcon = createIcon(
  "ArrowRightIcon",
  <>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </>,
);

export const ArrowLeftIcon = createIcon(
  "ArrowLeftIcon",
  <>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </>,
);

export const ChevronRightIcon = createIcon("ChevronRightIcon", <path d="m9.5 6 6 6-6 6" />);
export const ChevronDownIcon = createIcon("ChevronDownIcon", <path d="m6 9.5 6 6 6-6" />);
export const ChevronUpIcon = createIcon("ChevronUpIcon", <path d="m6 14.5 6-6 6 6" />);

export const CheckIcon = createIcon("CheckIcon", <path d="m5 12.5 4.25 4.25L19 7" />);

export const CloseIcon = createIcon(
  "CloseIcon",
  <>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </>,
);

export const PlusIcon = createIcon(
  "PlusIcon",
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);

export const SearchIcon = createIcon(
  "SearchIcon",
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.4-4.4" />
  </>,
);

export const EyeIcon = createIcon(
  "EyeIcon",
  <>
    <path d="M2.75 12S6.25 5.5 12 5.5 21.25 12 21.25 12 17.75 18.5 12 18.5 2.75 12 2.75 12z" />
    <circle cx="12" cy="12" r="2.75" />
  </>,
);

export const EyeOffIcon = createIcon(
  "EyeOffIcon",
  <>
    <path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c5.75 0 9.25 6.5 9.25 6.5a17 17 0 0 1-2.6 3.4M6.6 6.9C4.1 8.6 2.75 12 2.75 12S6.25 18.5 12 18.5c1.7 0 3.2-.6 4.5-1.4" />
    <path d="M10 10.1a2.75 2.75 0 0 0 3.9 3.9" />
    <path d="m3.5 3.5 17 17" />
  </>,
);

export const MailIcon = createIcon(
  "MailIcon",
  <>
    <rect x="3.25" y="5.5" width="17.5" height="13" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </>,
);

export const LockIcon = createIcon(
  "LockIcon",
  <>
    <rect x="4.75" y="10.5" width="14.5" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </>,
);

export const UserIcon = createIcon(
  "UserIcon",
  <>
    <circle cx="12" cy="8.5" r="3.75" />
    <path d="M4.75 20a7.25 7.25 0 0 1 14.5 0" />
  </>,
);

export const GraduationCapIcon = createIcon(
  "GraduationCapIcon",
  <>
    <path d="m2.5 9.5 9.5-4.75 9.5 4.75L12 14.25z" />
    <path d="M6.5 11.5v4.25c1.5 1.4 3.4 2.25 5.5 2.25s4-.85 5.5-2.25V11.5" />
    <path d="M21.5 9.5v5" />
  </>,
);

export const ClockIcon = createIcon(
  "ClockIcon",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);

export const LayersIcon = createIcon(
  "LayersIcon",
  <>
    <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" />
    <path d="m3.5 12 8.5 4.5 8.5-4.5" />
    <path d="m3.5 16 8.5 4.5 8.5-4.5" />
  </>,
);

export const MenuIcon = createIcon(
  "MenuIcon",
  <>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h10" />
  </>,
);

export const InfoIcon = createIcon(
  "InfoIcon",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r=".6" fill="currentColor" />
  </>,
);

export const AlertIcon = createIcon(
  "AlertIcon",
  <>
    <path d="M10.3 4.3 2.9 17.2A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0z" />
    <path d="M12 9.5v4" />
    <circle cx="12" cy="16.75" r=".6" fill="currentColor" />
  </>,
);

export const SparklesIcon = createIcon(
  "SparklesIcon",
  <>
    <path d="M10 3.5 11.6 8a2 2 0 0 0 1.2 1.2l4.5 1.6-4.5 1.6a2 2 0 0 0-1.2 1.2L10 18.1l-1.6-4.5a2 2 0 0 0-1.2-1.2L2.7 10.8l4.5-1.6A2 2 0 0 0 8.4 8z" />
    <path d="M18 14.5v5M15.5 17h5" />
    <path d="M18.5 3v3M17 4.5h3" />
  </>,
);

export const FlameIcon = createIcon(
  "FlameIcon",
  <path d="M12 21c-3.9 0-6.75-2.7-6.75-6.4 0-3.1 2-5.2 3.6-7 .4 1.7 1.3 2.9 2.4 3.4-.3-3.2 1.2-6 3.75-8 .2 2.9 1.7 4.6 3.1 6.2 1.3 1.5 2.65 3.1 2.65 5.6C20.75 18.3 17 21 12 21z" />,
);

export const SnowflakeIcon = createIcon(
  "SnowflakeIcon",
  <>
    <path d="M12 2.75v18.5M4 7.4l16 9.2M4 16.6l16-9.2" />
    <path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2M4.6 10.4l3.2-.5-1.2-3M19.4 13.6l-3.2.5 1.2 3M4.6 13.6l3.2.5-1.2 3M19.4 10.4l-3.2-.5 1.2-3" />
  </>,
);

export const LightbulbIcon = createIcon(
  "LightbulbIcon",
  <>
    <path d="M9 17.5h6" />
    <path d="M10 20.75h4" />
    <path d="M12 3.25a6 6 0 0 0-3.6 10.8c.5.4.85 1 .85 1.65v1.8h5.5v-1.8c0-.65.35-1.25.85-1.65A6 6 0 0 0 12 3.25z" />
  </>,
);

export const TrophyIcon = createIcon(
  "TrophyIcon",
  <>
    <path d="M7.5 4.5h9v4.75a4.5 4.5 0 0 1-9 0z" />
    <path d="M7.5 6.5H4.75v1.25A3.25 3.25 0 0 0 8 11M16.5 6.5h2.75v1.25A3.25 3.25 0 0 1 16 11" />
    <path d="M12 13.75V17M8.5 20.25h7M9.5 17h5v3.25h-5z" />
  </>,
);

export const StarIcon = createIcon(
  "StarIcon",
  <path d="m12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z" />,
);

export const BoltIcon = createIcon("BoltIcon", <path d="M13.25 2.75 5 13.25h6l-1.25 8 8.25-10.5h-6z" />);

export const GripIcon = createIcon(
  "GripIcon",
  <>
    <circle cx="9" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="17.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="17.5" r="1.2" fill="currentColor" stroke="none" />
  </>,
);

export const UndoIcon = createIcon(
  "UndoIcon",
  <>
    <path d="M8.5 5 4 9.5 8.5 14" />
    <path d="M4 9.5h10a5.5 5.5 0 0 1 0 11h-3" />
  </>,
);

export const PlayIcon = createIcon("PlayIcon", <path d="M7.5 5.25v13.5a.75.75 0 0 0 1.15.63l10.5-6.75a.75.75 0 0 0 0-1.26L8.65 4.62a.75.75 0 0 0-1.15.63z" />);

export const RefreshIcon = createIcon(
  "RefreshIcon",
  <>
    <path d="M19.5 12a7.5 7.5 0 0 1-13.1 5" />
    <path d="M4.5 12a7.5 7.5 0 0 1 13.1-5" />
    <path d="M17.75 3.5v3.75H14M6.25 20.5v-3.75H10" />
  </>,
);

export const CloudOffIcon = createIcon(
  "CloudOffIcon",
  <>
    <path d="M8.2 6.4A6 6 0 0 1 17.6 10a4.25 4.25 0 0 1 2.5 7.1M17 18.75H7a4.5 4.5 0 0 1-1.6-8.7" />
    <path d="m3.5 3.5 17 17" />
  </>,
);

export const MapIcon = createIcon(
  "MapIcon",
  <>
    <path d="m9 4.5-5.25 2v13l5.25-2 6 2 5.25-2v-13l-5.25 2z" />
    <path d="M9 4.5v13M15 6.5v13" />
  </>,
);

export const HeartIcon = createIcon(
  "HeartIcon",
  <path d="M12 19.75s-7.75-4.4-7.75-10A4.25 4.25 0 0 1 12 7.2a4.25 4.25 0 0 1 7.75 2.55c0 5.6-7.75 10-7.75 10z" />,
);

/** Learnly's mark: an open book whose page lifts into a rising path. */
export const LogoMark = createIcon(
  "LogoMark",
  <>
    <rect x="0.5" y="0.5" width="23" height="23" rx="7" fill="url(#learnly-logo-bg)" stroke="none" />
    <defs>
      <linearGradient id="learnly-logo-bg" x1="3" y1="1.5" x2="21" y2="22.5" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#7474E8" />
        <stop offset="1" stopColor="#4646C2" />
      </linearGradient>
    </defs>
    <path d="M5.25 8.1c2.1-.9 4.35-.75 6.4.6v9c-2.05-1.35-4.3-1.5-6.4-.6z" fill="#FBFAF7" stroke="none" />
    <path d="M12.4 8.7c2.05-1.35 4.3-1.5 6.4-.6v4.7" stroke="#FBFAF7" strokeWidth="1.4" />
    <circle cx="18.75" cy="15.2" r="2.05" fill="#FF7A59" stroke="none" />
  </>,
);

