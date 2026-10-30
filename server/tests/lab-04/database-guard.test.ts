import { afterEach, describe, expect, it, vi } from "vitest";
import { disposableUrl } from "./fixture.js";

afterEach(() => vi.unstubAllEnvs());
describe('Lab 4 disposable database guard', () => {
  it('refuses missing explicit write permission even for a test-named DB', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/toktickit_test');
    vi.stubEnv('E2E_ALLOW_DB_WRITE', '');
    expect(() => disposableUrl()).toThrow('E2E_ALLOW_DB_WRITE');
  });
  it.each(['toktickit', 'production', 'development', 'production_contest', 'production_latest', 'testing', 'testdb', 'e2eish', 'nondisposable', 'production%5Fcontest'])('refuses unsafe database %s', name => {
    vi.stubEnv('DATABASE_URL', `postgresql://localhost/${name}`); vi.stubEnv('E2E_ALLOW_DB_WRITE', '1');
    expect(() => disposableUrl()).toThrow('non-disposable');
  });
  it.each(['test', 'e2e', 'disposable', 'toktickit_lab4_test', 'toktickit-e2e-20261028', 'toktickit_DISPOSABLE_review'])('accepts a separated disposable token in %s', name => {
    vi.stubEnv('DATABASE_URL', `postgresql://localhost/${name}`); vi.stubEnv('E2E_ALLOW_DB_WRITE', '1');
    expect(disposableUrl().pathname).toBe('/'+name);
  });
  it('accepts only an explicit disposable PostgreSQL target', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/toktickit_lab4_test'); vi.stubEnv('E2E_ALLOW_DB_WRITE', '1');
    expect(disposableUrl().pathname).toBe('/toktickit_lab4_test');
    vi.stubEnv('DATABASE_URL', 'https://example.com/test');
    expect(() => disposableUrl()).toThrow('non-disposable');
  });
});
