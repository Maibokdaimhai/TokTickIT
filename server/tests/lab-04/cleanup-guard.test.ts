import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { unauditedFixtureTickets, removeUnreferencedFixtureUsers } from '../audit-fixture-cleanup.js';

afterEach(() => vi.unstubAllEnvs());
describe('Cleanup rejects unsafe targets before accessing the database', () => {
  it.each(['production_contest','production_latest','nondisposable','e2eish'])('refuses reads and deletes on %s even with write opt-in', async name => {
    vi.stubEnv('DATABASE_URL', `postgresql://unused:unused@localhost/${name}`); vi.stubEnv('E2E_ALLOW_DB_WRITE','1');
    const findMany = vi.fn(), deleteMany = vi.fn();
    const db = { ticket: { findMany }, user: { deleteMany } } as unknown as PrismaClient;
    await expect(unauditedFixtureTickets(db,[1])).rejects.toThrow();
    await expect(removeUnreferencedFixtureUsers(db,[1])).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled(); expect(deleteMany).not.toHaveBeenCalled();
  });
  it('still permits scoped cleanup of an explicitly named test database', async () => {
    vi.stubEnv('DATABASE_URL','postgresql://unused:unused@localhost/toktickit_test_review'); vi.stubEnv('E2E_ALLOW_DB_WRITE','1');
    const findMany = vi.fn().mockResolvedValue([{id:7}]), deleteMany = vi.fn().mockResolvedValue({count:1});
    const db = { ticket: { findMany }, user: { deleteMany } } as unknown as PrismaClient;
    expect(await unauditedFixtureTickets(db,[7])).toEqual([7]); await removeUnreferencedFixtureUsers(db,[9]);
    expect(findMany).toHaveBeenCalledOnce(); expect(deleteMany).toHaveBeenCalledOnce();
  });
});
