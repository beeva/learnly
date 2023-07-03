import type { GradeBand, Role, User, UserId } from "@learnly/shared";
import { isUniqueViolation, toIso, type Database } from "../../db/sql.js";
import { conflict } from "../../lib/errors.js";

export type Locale = "en" | "es" | "fil";

export interface Preferences {
  dailyGoalMinutes: number;
  reducedMotion: boolean;
  soundEffects: boolean;
  locale: Locale;
}

export const DEFAULT_PREFERENCES: Omit<Preferences, "locale"> = {
  dailyGoalMinutes: 15,
  reducedMotion: false,
  soundEffects: true,
};

export interface NewUser {
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  gradeBand: GradeBand | null;
  avatarColor: string;
  locale: Locale;
}

export interface UserWithSecret {
  user: User;
  passwordHash: string;
}

/** Everything a learner can change about their own profile. */
export interface ProfilePatch {
  displayName?: string;
  avatarColor?: string;
  locale?: Locale;
  dailyGoalMinutes?: number;
  reducedMotion?: boolean;
  soundEffects?: boolean;
}

export interface UserRepository {
  create(input: NewUser): Promise<User>;
  findByEmail(email: string): Promise<UserWithSecret | null>;
  findById(id: UserId): Promise<User | null>;
  getPreferences(id: UserId): Promise<Preferences | null>;
  updateProfile(id: UserId, patch: ProfilePatch): Promise<Preferences | null>;
}

export function toLocale(value: string | null | undefined): Locale {
  return value === "es" || value === "fil" ? value : "en";
}

interface UserRow {
  id: UserId;
  email: string;
  display_name: string;
  role: Role;
  grade_band: GradeBand | null;
  avatar_color: string;
  locale: string;
  created_at: Date;
}

interface PreferencesRow {
  daily_goal_minutes: number | null;
  reduced_motion: boolean | null;
  sound_effects: boolean | null;
  locale: string;
}

const USER_COLUMNS = "id, email, display_name, role, grade_band, avatar_color, locale, created_at";

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    gradeBand: row.grade_band,
    avatarColor: row.avatar_color,
    locale: row.locale,
    createdAt: toIso(row.created_at),
  };
}

function toPreferences(row: PreferencesRow): Preferences {
  return {
    dailyGoalMinutes: row.daily_goal_minutes ?? DEFAULT_PREFERENCES.dailyGoalMinutes,
    reducedMotion: row.reduced_motion ?? DEFAULT_PREFERENCES.reducedMotion,
    soundEffects: row.sound_effects ?? DEFAULT_PREFERENCES.soundEffects,
    locale: toLocale(row.locale),
  };
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewUser): Promise<User> {
    try {
      const row = await this.db.one<UserRow>(
        `with created as (
           insert into users (email, password_hash, display_name, role, grade_band, avatar_color, locale)
           values ($1, $2, $3, $4, $5, $6, $7)
           returning ${USER_COLUMNS}
         ), prefs as (
           insert into user_preferences (user_id) select id from created
         )
         select ${USER_COLUMNS} from created`,
        [
          input.email,
          input.passwordHash,
          input.displayName,
          input.role,
          input.gradeBand,
          input.avatarColor,
          input.locale,
        ],
      );
      return toUser(row);
    } catch (error) {
      if (isUniqueViolation(error, "users_email_key")) {
        throw conflict("An account with this email already exists. Try signing in instead.");
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserWithSecret | null> {
    const row = await this.db.maybeOne<UserRow & { password_hash: string }>(
      `select ${USER_COLUMNS}, password_hash from users where lower(email) = lower($1)`,
      [email],
    );
    return row ? { user: toUser(row), passwordHash: row.password_hash } : null;
  }

  async findById(id: UserId): Promise<User | null> {
    const row = await this.db.maybeOne<UserRow>(`select ${USER_COLUMNS} from users where id = $1`, [id]);
    return row ? toUser(row) : null;
  }

  async getPreferences(id: UserId): Promise<Preferences | null> {
    const row = await this.db.maybeOne<PreferencesRow>(
      `select p.daily_goal_minutes, p.reduced_motion, p.sound_effects, u.locale
         from users u
         left join user_preferences p on p.user_id = u.id
        where u.id = $1`,
      [id],
    );
    return row ? toPreferences(row) : null;
  }

  async updateProfile(id: UserId, patch: ProfilePatch): Promise<Preferences | null> {
    return this.db.transaction(async () => {
      const updated = await this.db.query(
        `update users
            set display_name = coalesce($2, display_name),
                avatar_color = coalesce($3, avatar_color),
                locale       = coalesce($4, locale),
                updated_at   = now()
          where id = $1
          returning id`,
        [id, patch.displayName ?? null, patch.avatarColor ?? null, patch.locale ?? null],
      );
      if (updated.length === 0) return null;
      await this.db.query(
        `insert into user_preferences (user_id, daily_goal_minutes, reduced_motion, sound_effects)
         values ($1, coalesce($2, $5), coalesce($3, $6), coalesce($4, $7))
         on conflict (user_id) do update
            set daily_goal_minutes = coalesce($2, user_preferences.daily_goal_minutes),
                reduced_motion     = coalesce($3, user_preferences.reduced_motion),
                sound_effects      = coalesce($4, user_preferences.sound_effects),
                updated_at         = now()`,
        [
          id,
          patch.dailyGoalMinutes ?? null,
          patch.reducedMotion ?? null,
          patch.soundEffects ?? null,
          DEFAULT_PREFERENCES.dailyGoalMinutes,
          DEFAULT_PREFERENCES.reducedMotion,
          DEFAULT_PREFERENCES.soundEffects,
        ],
      );
      return this.getPreferences(id);
    });
  }
}
