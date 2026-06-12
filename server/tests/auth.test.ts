import { describe, expect, it } from "vitest";
import {
  hashPassword,
  passwordNeedsRehash,
  verifyPassword,
} from "../auth";

describe("password hashing", () => {
  it("creates and verifies a versioned scrypt hash", () => {
    const hash = hashPassword("correct horse battery staple");

    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(verifyPassword("wrong password", hash)).toBe(false);
    expect(passwordNeedsRehash(hash)).toBe(false);
  });

  it("accepts legacy hashes and marks them for migration", async () => {
    const crypto = await import("crypto");
    const salt = "0123456789abcdef0123456789abcdef";
    const legacyHash = crypto
      .pbkdf2Sync("legacy-password", salt, 1000, 64, "sha512")
      .toString("hex");
    const stored = `${salt}:${legacyHash}`;

    expect(verifyPassword("legacy-password", stored)).toBe(true);
    expect(passwordNeedsRehash(stored)).toBe(true);
  });
});
