type Environment = Record<string, string | undefined>;
/** Trust only server configuration, never a caller-supplied Host/Forwarded header. */
export function trustedOrigins(env: Environment): string[] {
  const candidates = [env.APP_ORIGIN];
  for (const host of [
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
    env.VERCEL_BRANCH_URL,
  ]) {
    if (host)
      candidates.push(host.startsWith("https://") ? host : `https://${host}`);
  }
  return [
    ...new Set(
      candidates.flatMap((value) => {
        if (!value) return [];
        try {
          const parsed = new URL(value);
          return ["http:", "https:"].includes(parsed.protocol) &&
            !parsed.username &&
            !parsed.password
            ? [parsed.origin]
            : [];
        } catch {
          return [];
        }
      }),
    ),
  ];
}
export function originDecision(
  origin: string | null,
  env: Environment,
): "allowed" | "unconfigured" | "rejected" {
  const allowed = trustedOrigins(env);
  if (!allowed.length) return "unconfigured";
  return origin !== null && allowed.includes(origin) ? "allowed" : "rejected";
}
