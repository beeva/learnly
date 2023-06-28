import argon2 from "@node-rs/argon2";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

/** OWASP's recommended argon2id baseline: 19 MiB memory, 2 iterations, 1 lane. */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export const argon2Hasher: PasswordHasher = {
  hash: (password) => argon2.hash(password, ARGON2_OPTIONS),
  async verify(hash, password) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // A malformed hash (e.g. a legacy row) is treated as a mismatch, never a crash.
      return false;
    }
  },
};
