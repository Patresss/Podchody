import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "podchody_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;

type SessionPayload = {
  username: string;
  expiresAt: number;
};

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  if (password.length < 10) {
    throw new Error("Hasło musi mieć co najmniej 10 znaków.");
  }
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, salt, expectedHex] = encodedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken(username: string, secret: string) {
  const payload: SessionPayload = {
    username,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function readSessionToken(token: string | undefined, secret: string): SessionPayload | null {
  if (!token) return null;
  const [body, suppliedSignature] = token.split(".");
  if (!body || !suppliedSignature) return null;
  const expectedSignature = createHmac("sha256", secret).update(body).digest();
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.username || payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: Response, token: string, secure: boolean) {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: SESSION_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(response: Response, secure: boolean) {
  response.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure, path: "/" });
}

export function authMiddleware(secret: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const session = readSessionToken(request.cookies?.[COOKIE_NAME], secret);
    if (!session) {
      response.status(401).json({ error: "Sesja wygasła. Zaloguj się ponownie." });
      return;
    }
    response.locals.session = session;
    next();
  };
}

export { COOKIE_NAME };
