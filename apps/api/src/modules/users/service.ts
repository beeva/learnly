import type { User, UserId } from "@learnly/shared";
import { notFound } from "../../lib/errors.js";
import type { Preferences, ProfilePatch, UserRepository } from "./repository.js";

export interface MeResponse {
  user: User;
  preferences: Preferences;
}

/** Decorated by later features (progress adds a `progress` summary to `/me`). */
export interface ProfileApi {
  get(userId: UserId): Promise<MeResponse>;
  updatePreferences(userId: UserId, patch: ProfilePatch): Promise<Preferences>;
}

export class ProfileService implements ProfileApi {
  constructor(private readonly users: UserRepository) {}

  async get(userId: UserId): Promise<MeResponse> {
    const [user, preferences] = await Promise.all([
      this.users.findById(userId),
      this.users.getPreferences(userId),
    ]);
    if (!user || !preferences) throw notFound("account");
    return { user, preferences };
  }

  async updatePreferences(userId: UserId, patch: ProfilePatch): Promise<Preferences> {
    const preferences = await this.users.updateProfile(userId, patch);
    if (!preferences) throw notFound("account");
    return preferences;
  }
}
