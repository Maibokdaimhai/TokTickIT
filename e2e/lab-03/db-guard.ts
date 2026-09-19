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

  // Extract and decode only the database pathname
  const rawPathname = parsed.pathname;
  if (!rawPathname || rawPathname === "/") {
    return {
      valid: false,
      dbName: "",
      error: "Safety check failed: DATABASE_URL does not specify a database name.",
    };
  }

  let dbName = decodeURIComponent(rawPathname);
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

  // Accept only database names containing an approved disposable marker
  const lowerName = dbName.toLowerCase();
  const hasDisposableMarker =
    lowerName.includes("e2e") ||
    lowerName.includes("test") ||
    lowerName.includes("disposable");

  if (!hasDisposableMarker) {
    return {
      valid: false,
      dbName,
      error: `Safety check failed: Database name '${dbName}' must contain an approved disposable marker ('e2e', 'test', or 'disposable').`,
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
