import { afterEach, describe, expect, it, vi } from "vitest";
import { disposableUrl } from "./fixture.js";

afterEach(() => vi.unstubAllEnvs());
describe('Lab 4 disposable database guard', () => {
  it('refuses missing explicit write permission even for a test-named DB', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/toktickit_test');
    vi.stubEnv('E2E_ALLOW_DB_WRITE', '');
    expect(() => disposableUrl()).toThrow('E2E_ALLOW_DB_WRITE');
  });
  it.each(['toktickit', 'production', 'development'])('refuses unsafe database %s', name => {
    vi.stubEnv('DATABASE_URL', `postgresql://localhost/${name}`); vi.stubEnv('E2E_ALLOW_DB_WRITE', '1');
    expect(() => disposableUrl()).toThrow('non-disposable');
  });
  it('accepts only an explicit disposable PostgreSQL target', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/toktickit_lab4_test'); vi.stubEnv('E2E_ALLOW_DB_WRITE', '1');
    expect(disposableUrl().pathname).toBe('/toktickit_lab4_test');
    vi.stubEnv('DATABASE_URL', 'https://example.com/test');
    expect(() => disposableUrl()).toThrow('non-disposable');
  });
});
