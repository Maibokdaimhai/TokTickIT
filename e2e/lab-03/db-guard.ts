export function hasDisposableNameToken(name: string): boolean {
  return /(?:^|[_-])(?:test|e2e|disposable)(?:$|[_-])/i.test(name);
}

export interface DbGuardResult {
  valid: boolean;
  dbName: string;
  error?: string;
}

export function validateDatabaseUrl(databaseUrl?: string, allowDbWrite?: string): DbGuardResult {
  if (allowDbWrite !== "1") {
    return {
      valid: false,
      dbName: "",
      error: "Safety check failed: E2E_ALLOW_DB_WRITE must be explicitly set to '1' to run E2E tests with database writes.",
    };
  }

  if (!databaseUrl || typeof databaseUrl !== "string") {
    return {
      valid: false,
      dbName: "",
      error: "Safety check failed: DATABASE_URL is missing or empty.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return {
      valid: false,
      dbName: "",
      error: "Safety check failed: DATABASE_URL is malformed.",
    };
  }

  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) return { valid: false, dbName: "", error: "Safety check failed: PostgreSQL URL required." };

  // Extract and decode only the database pathname
  const rawPathname = parsed.pathname;
  if (!rawPathname || rawPathname === "/") {
    return {
      valid: false,
      dbName: "",
      error: "Safety check failed: DATABASE_URL does not specify a database name.",
    };
  }

  let dbName: string;
  try { dbName = decodeURIComponent(rawPathname); } catch { return { valid: false, dbName: "", error: "Safety check failed: Invalid database pathname encoding." }; }
  if (dbName.startsWith("/")) {
    dbName = dbName.slice(1);
  }

  // Reject the exact development database 'toktickit'
  if (dbName === "toktickit") {
    return {
      valid: false,
      dbName,
      error: "Safety check failed: Refusing to run tests against the development database 'toktickit'.",
    };
  }

  // Only underscore/hyphen-separated marker tokens are approved. A word such
  // as "contest" or "latest" is not an explicit disposable database name.
  const hasDisposableMarker = hasDisposableNameToken(dbName);

  if (!hasDisposableMarker) {
    return {
      valid: false,
      dbName,
      error: `Safety check failed: Database name '${dbName}' must contain a separated disposable token ('e2e', 'test', or 'disposable') delimited by '_' or '-'.`,
    };
  }

  return {
    valid: true,
    dbName,
  };
}

export function assertSafeDatabaseUrl(databaseUrl?: string, allowDbWrite?: string): string {
  const result = validateDatabaseUrl(databaseUrl, allowDbWrite);
  if (!result.valid) {
    throw new Error(result.error);
  }
  return result.dbName;
}
