import type { Role } from "@learnly/shared";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Avatar, Badge, IconButton, cx } from "../ui/components";
import { LogOutIcon, LogoMark, MoonIcon, SunIcon, type IconComponent } from "../ui/icons";
import styles from "./AppShell.module.css";

/* ------------------------------------------------------------ navigation */

export interface NavItem {
  /** Stable id, also used as the translation key suffix (`nav.<id>`). */
  id: string;
  to: string;
  label: string;
  icon: IconComponent;
  /** Lower numbers come first. */
  order: number;
  /** Only show to these roles; everyone when omitted. */
  roles?: Role[];
}

const navItems: NavItem[] = [];

/** Features register their own entry so the shell never needs to know about them. */
export function registerNavItem(item: NavItem): void {
  const existing = navItems.findIndex((candidate) => candidate.id === item.id);
  if (existing >= 0) navItems.splice(existing, 1, item);
  else navItems.push(item);
  navItems.sort((a, b) => a.order - b.order);
}

export const shellConfig = {
  /** Resolves the visible label for a nav item; swapped out once copy is localized. */
  navLabel: (item: NavItem): string => item.label,
};


/* ------------------------------------------------------------------ slots */

export type ShellSlot = "banner" | "sidebarFooter";

const slots: Record<ShellSlot, ComponentType[]> = { banner: [], sidebarFooter: [] };

/** Mount app-wide UI (status banners, switchers) inside the shell without editing it. */
export function registerShellSlot(slot: ShellSlot, component: ComponentType): void {
  if (!slots[slot].includes(component)) slots[slot].push(component);
}

function Slot({ name }: { name: ShellSlot }) {
  return (
    <>
      {slots[name].map((Component, index) => (
        <Component key={index} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ theme */

export type ThemeChoice = "light" | "dark" | "system";
const THEME_KEY = "learnly.theme";
const themeListeners = new Set<() => void>();

function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function setTheme(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* storage unavailable: still apply for this visit */
  }
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  themeListeners.forEach((listener) => listener());
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", listener);
  return () => {
    themeListeners.delete(listener);
    media?.removeEventListener?.("change", listener);
  };
}

/** The saved choice plus what is actually on screen right now. */
export function useTheme() {
  const choice = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as ThemeChoice);
  const systemDark = useSyncExternalStore(
    subscribeTheme,
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
    () => false,
  );
  const resolved: "light" | "dark" = choice === "system" ? (systemDark ? "dark" : "light") : choice;
  return { choice, resolved, setTheme };
}

function ThemeToggle() {
  const { resolved } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <IconButton
      icon={resolved === "dark" ? SunIcon : MoonIcon}
      label={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    />
  );
}

/* ------------------------------------------------------------------ shell */

const ROLE_LABEL: Record<Role, string> = { student: "Student", educator: "Educator", admin: "Admin" };

function visibleNav(role: Role | undefined) {
  return navItems.filter((item) => !item.roles || (role !== undefined && item.roles.includes(role)));
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const items = visibleNav(user?.role);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/", { replace: true });
  }, [navigate, signOut]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Primary">
        <NavLink to="/home" className={styles.brand}>
          <LogoMark size={36} />
          <span className={styles.wordmark}>Learnly</span>
        </NavLink>

        <nav className={styles.nav} aria-label="Main">
          <ul role="list" className={styles.navList}>
            {items.map((item) => (
              <li key={item.id}>
                <NavLink to={item.to} className={({ isActive }) => cx(styles.navLink, isActive && styles.navLinkActive)}>
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <motion.span
                          layoutId="sidebar-active"
                          className={styles.navActiveBg}
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        />
                      ) : null}
                      <item.icon size={20} className={styles.navIcon} />
                      <span className={styles.navLabel}>{shellConfig.navLabel(item)}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <Slot name="sidebarFooter" />
          {user ? (
            <div className={styles.userCard}>
              <Avatar name={user.displayName} color={user.avatarColor} size={40} />
              <div className={styles.userText}>
                <span className={styles.userName}>{user.displayName}</span>
                <Badge size="sm" tone={user.role === "student" ? "primary" : "accent"}>
                  {ROLE_LABEL[user.role]}
                </Badge>
              </div>
              <div className={styles.userActions}>
                <ThemeToggle />
                <IconButton icon={LogOutIcon} label="Sign out" onClick={handleSignOut} />
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <header className={cx(styles.topbar, scrolled && styles.topbarScrolled)}>
        <NavLink to="/home" className={styles.brand}>
          <LogoMark size={32} />
          <span className={styles.wordmark}>Learnly</span>
        </NavLink>
        <div className={styles.topbarActions}>
          <ThemeToggle />
          <IconButton icon={LogOutIcon} label="Sign out" onClick={handleSignOut} />
          {user ? <Avatar name={user.displayName} color={user.avatarColor} size={34} /> : null}
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.banners}>
          <Slot name="banner" />
        </div>
        <main id="main" tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
      </div>

      <nav className={styles.bottomNav} aria-label="Main">
        <ul role="list" className={styles.bottomList}>
          {items.slice(0, 5).map((item) => (
            <li key={item.id}>
              <NavLink to={item.to} className={({ isActive }) => cx(styles.bottomLink, isActive && styles.bottomLinkActive)}>
                {({ isActive }) => (
                  <>
                    <span className={styles.bottomIconWrap}>
                      {isActive ? (
                        <motion.span layoutId="bottom-active" className={styles.bottomActiveBg} transition={{ type: "spring", stiffness: 500, damping: 38 }} />
                      ) : null}
                      <item.icon size={22} className={styles.bottomIcon} />
                    </span>
                    <span className={styles.bottomLabel}>{shellConfig.navLabel(item)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Distraction-free frame for lessons, practice and the diagnostic. */
export function FocusLayout() {
  return (
    <div className={styles.focus}>
      <div className={styles.focusBanners}>
        <Slot name="banner" />
      </div>
      <main id="main" tabIndex={-1} className={styles.focusMain}>
        <Outlet />
      </main>
    </div>
  );
}
