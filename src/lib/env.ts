// Astro loads `.env` into `import.meta.env` only — never into `process.env`.
// On Vercel the opposite is true: secrets arrive through `process.env` at runtime.
// Read both, runtime first, so the same code works in dev and in production.
//
// Keys must be listed statically: Vite inlines `import.meta.env.FOO` at build
// time, so a dynamic lookup like `import.meta.env[key]` resolves to nothing.
const metaEnv: Record<string, string | undefined> = {
  DATABASE_URL: import.meta.env.DATABASE_URL,
  JWT_SECRET: import.meta.env.JWT_SECRET,
  R2_ENDPOINT: import.meta.env.R2_ENDPOINT,
  R2_ACCESS_KEY: import.meta.env.R2_ACCESS_KEY,
  R2_SECRET_KEY: import.meta.env.R2_SECRET_KEY,
  R2_BUCKET: import.meta.env.R2_BUCKET,
  R2_PUBLIC_URL: import.meta.env.R2_PUBLIC_URL,
  MAILTRAP_HOST: import.meta.env.MAILTRAP_HOST,
  MAILTRAP_PORT: import.meta.env.MAILTRAP_PORT,
  MAILTRAP_USER: import.meta.env.MAILTRAP_USER,
  MAILTRAP_PASS: import.meta.env.MAILTRAP_PASS,
  MAIL_FROM: import.meta.env.MAIL_FROM,
  PUBLIC_SITE_URL: import.meta.env.PUBLIC_SITE_URL,
};

export function env(key: keyof typeof metaEnv | string): string | undefined {
  return process.env[key] ?? metaEnv[key];
}

export function requireEnv(key: string): string {
  const value = env(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}
