import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../../src/App.js';
import * as shared from '../../src/api.js';
import * as api from '../../src/actions-api.js';
import type { AuthUser, StaffTicketDetail, TicketAction } from '../../src/types.js';

vi.mock('../../src/api.js', async original => ({ ...await original<typeof shared>(), getSession: vi.fn(), logout: vi.fn(), fetchStaffTicketDetail: vi.fn(), fetchTicketDetail: vi.fn(), fetchEligibleOwners: vi.fn(), fetchCategories: vi.fn(), fetchStaffTickets: vi.fn() }));
vi.mock('../../src/actions-api.js', () => ({ fetchActions: vi.fn(), fetchAction: vi.fn(), fetchActionRevisions: vi.fn(), createAction: vi.fn(), updateAction: vi.fn(), completeActionFollowUp: vi.fn() }));
const staff: AuthUser = { id: 7, name: 'Alex Staff', email: 'alex@example.com', role: 'IT_STAFF', isActive: true };
const requester: AuthUser = { ...staff, id: 1, name: 'Owned Requester', role: 'REQUESTER' };
const ticket: StaffTicketDetail = { id: 1, ticketNumber: 'TKT-2026-000001', requesterId: 1, requester, categoryId: 1, category: { id: 1, name: 'Network' }, relatedSystemId: 1, relatedSystem: { id: 1, name: 'Wi-Fi' }, summary: 'Network support', description: 'Original Ticket details', requestedPriority: 'HIGH', itPriority: 'HIGH', status: 'OPEN', version: 1, owner: { ...staff, role: 'IT_STAFF' }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', attachments: [], publicComments: [], internalNotes: [] };
const action: TicketAction = { id: 4, ticketId: 1, actionAt: '2026-01-02T02:00:00Z', description: 'Shared action information', result: null, performedBy: staff, assignee: staff, status: 'IN_PROGRESS', version: 0, followUpRequired: false, followUpNote: null, attachmentNotes: null, followUpCompletedAt: null, followUpCompletedBy: null, followUpCompletionNote: null, createdAt: '2026-01-02T02:00:00Z', updatedAt: '2026-01-02T02:00:00Z' };
beforeEach(() => {
  vi.resetAllMocks(); window.history.replaceState(null, '', '/staff/tickets/1');
  vi.mocked(shared.getSession).mockResolvedValue({ user: staff, mustChangePassword: false });
  vi.mocked(shared.fetchStaffTicketDetail).mockResolvedValue(ticket); vi.mocked(shared.fetchTicketDetail).mockResolvedValue(ticket);
  vi.mocked(shared.fetchEligibleOwners).mockResolvedValue({ owners: [{ ...staff, role: 'IT_STAFF' }] });
  vi.mocked(api.fetchActions).mockResolvedValue({ actions: [action], ticketVersion: 1, pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 } });
  vi.mocked(shared.fetchCategories).mockResolvedValue([]); vi.mocked(shared.fetchStaffTickets).mockResolvedValue({ tickets: [], pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
});
afterEach(() => vi.restoreAllMocks());
describe('Actions Taken wired into authenticated Ticket Detail', () => {
  it('passes the session Staff identity to the editor and refreshes parent data after saving', async () => {
    vi.mocked(api.createAction).mockResolvedValue({ action: { ...action, id: 5 }, ticketVersion: 2 });
    vi.mocked(api.fetchAction).mockResolvedValue({ action: { ...action, id: 5 }, ticketVersion: 2 });
    render(<App />); await screen.findByText('Shared action information');
    fireEvent.click(screen.getByRole('button', { name: 'New Action' }));
    await screen.findByRole('option', { name: 'Alex Staff' });
    expect(screen.getByText('Performed by (automatic):')).toHaveTextContent('Alex Staff');
    fireEvent.change(screen.getByLabelText('Action Description'), { target: { value: 'Inspect routing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Action' }));
    await waitFor(() => expect(shared.fetchStaffTicketDetail).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Action saved.')).toBeInTheDocument();
  });
  it('shows the shared action section read-only on the Requester route', async () => {
    window.history.replaceState(null, '', '/tickets/1'); vi.mocked(shared.getSession).mockResolvedValue({ user: requester, mustChangePassword: false });
    render(<App />); await screen.findByText('Shared action information');
    expect(screen.queryByRole('button', { name: 'New Action' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Edit Action #4' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View History for Action #4' })).toBeInTheDocument();
  });
  it('protects a dirty Action draft when navigation or sign out is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />); await screen.findByText('Shared action information'); fireEvent.click(screen.getByRole('button', { name: 'New Action' }));
    await screen.findByRole('option', { name: 'Alex Staff' });
    fireEvent.change(screen.getByLabelText('Action Description'), { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByTestId('nav-ticket-queue'));
    expect(window.location.pathname).toBe('/staff/tickets/1'); expect(screen.getByLabelText('Action Description')).toHaveValue('Keep this draft');
    act(() => { window.history.replaceState(null, '', '/staff/tickets'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(window.location.pathname).toBe('/staff/tickets/1'); expect(screen.getByLabelText('Action Description')).toHaveValue('Keep this draft');
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' })); fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(shared.logout).not.toHaveBeenCalled(); expect(screen.getByLabelText('Action Description')).toHaveValue('Keep this draft');
  });
});
