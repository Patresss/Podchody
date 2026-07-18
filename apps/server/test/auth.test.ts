import { describe, expect, it } from "vitest";
import { createSessionToken, hashPassword, readSessionToken, verifyPassword } from "../src/auth.js";

describe("authentication", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("bardzo-dobre-haslo");
    expect(hash).not.toContain("bardzo-dobre-haslo");
    await expect(verifyPassword("bardzo-dobre-haslo", hash)).resolves.toBe(true);
    await expect(verifyPassword("zle-haslo", hash)).resolves.toBe(false);
  });

  it("signs sessions and rejects modified tokens", () => {
    const secret = "01234567890123456789012345678901";
    const token = createSessionToken("admin", secret);
    expect(readSessionToken(token, secret)?.username).toBe("admin");
    expect(readSessionToken(`${token}x`, secret)).toBeNull();
  });
});
