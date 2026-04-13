import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { Request } from "express";

const ALGORITHM = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function encryptToken(token: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptToken(encoded: string, secret: string): string | null {
  try {
    const key = deriveKey(secret);
    const buf = Buffer.from(encoded, "base64url");
    if (buf.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function getSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-secret-change-in-prod";
}

export function setGithubToken(req: Request, token: string): void {
  if (req.session) req.session.githubToken = encryptToken(token, getSecret());
}

export function getGithubToken(req: Request): string | null {
  const raw = req.session?.githubToken as string | undefined | null;
  if (!raw) return null;
  return decryptToken(raw, getSecret());
}

export function clearGithubToken(req: Request): void {
  if (req.session) req.session.githubToken = null;
}

export function destroySession(req: Request): void {
  req.session = null;
}

export function setOauthState(req: Request, state: string): void {
  if (req.session) req.session.oauthState = state;
}

export function getAndClearOauthState(req: Request): string | null {
  const state = req.session?.oauthState as string | undefined | null;
  if (req.session) req.session.oauthState = null;
  return state ?? null;
}

export function getCallbackUrl(req: Request): string {
  const override = process.env.GITHUB_CALLBACK_URL;
  if (override) return override;

  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  if (replitDomain) return `https://${replitDomain}/api/github/auth/callback`;

  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0].trim() ??
    req.protocol ??
    "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0].trim() ??
    req.headers.host ??
    "localhost";
  return `${proto}://${host}/api/github/auth/callback`;
}
