import React from 'react';
import { describe,it,expect,vi,beforeEach } from 'vitest';
import { render,screen,fireEvent,waitFor,act,within } from '@testing-library/react';
import { Dashboard,MyActiveActions } from '../../src/components/Dashboard.js';
import * as api from '../../src/dashboard-api.js';
import type { RequesterDashboard,StaffDashboard,ActionPreview } from '../../src/types.js';
vi.mock('../../src/dashboard-api.js',()=>({fetchRequesterDashboard:vi.fn(),fetchStaffDashboard:vi.fn(),fetchMyActions:vi.fn()}));
const windowData={asOf:'2026-10-28T01:00:00.000Z',windowStart:'2026-10-21T17:00:00.000Z',timeZone:'Asia/Bangkok' as const};
const requester:RequesterDashboard={...windowData,metrics:{activeTickets:22,waitingForRequester:3,recentlyResolved:0},recentlyResolvedIncludesEstimates:true,recentTickets:[{id:11,ticketNumber:'TKT-11',summary:'Keyboard issue',status:'OPEN',itPriority:'HIGH',owner:null,updatedAt:windowData.asOf}]};
const staff:StaffDashboard={...windowData,metrics:{unassignedTickets:12,myTickets:7,myActiveActions:4},byStatus:{NEW:3,OPEN:7,IN_PROGRESS:2,WAITING_FOR_REQUESTER:1,RESOLVED:4,CLOSED:9,REOPENED:2,CANCELLED:0},byItPriority:{URGENT:5,HIGH:4,MEDIUM:3,LOW:0},recentTickets:requester.recentTickets,myActions:[]};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.fetchRequesterDashboard).mockResolvedValue(requester);vi.mocked(api.fetchStaffDashboard).mockResolvedValue(staff);});
describe('Role dashboards',()=>{
 it('renders authoritative counts, estimate note and exact zero-count/date-window links',async()=>{
  const navigate=vi.fn();render(<Dashboard staff={false} navigate={navigate}/>);
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  const active=await screen.findByRole('link',{name:'Active Tickets 22'});expect(active).toHaveAttribute('href','/my-tickets?statusGroup=active');
  expect(screen.getByRole('link',{name:'Waiting for You 3'})).toHaveAttribute('href','/my-tickets?status=WAITING_FOR_REQUESTER');
  const recent=screen.getByRole('link',{name:'Recently Resolved (Last 7 Calendar Dates) 0'}),q=new URL(recent.getAttribute('href')!,'http://localhost').searchParams;
  expect(q.get('resolvedFrom')).toBe(windowData.windowStart);expect(q.get('resolvedTo')).toBe(windowData.asOf);
  expect(screen.getByText(/includes estimated/)).toBeInTheDocument();expect(screen.getByText(/Asia\/Bangkok/)).toBeInTheDocument();
  fireEvent.click(active);expect(navigate).toHaveBeenCalledWith('/my-tickets?statusGroup=active');
  expect(screen.getByRole('link',{name:'TKT-11: Keyboard issue'})).toHaveAttribute('href','/tickets/11');
 });
 it('renders all status/priority buckets and Staff-scoped routes',async()=>{
  render(<Dashboard staff navigate={vi.fn()}/>);
  expect(await screen.findByRole('link',{name:'My Active Tickets 7'})).toHaveAttribute('href','/staff/tickets?statusGroup=active&owner=me');
  expect(screen.getByRole('link',{name:'Unassigned Active Tickets 12'})).toHaveAttribute('href','/staff/tickets?statusGroup=active&owner=unassigned');
  expect(screen.getByRole('link',{name:'My Active Actions 4'})).toHaveAttribute('href','/staff/actions?assignee=me&statusGroup=active');
  expect(screen.getByRole('link',{name:'Cancelled: 0'})).toHaveAttribute('href','/staff/tickets?status=CANCELLED');
  expect(screen.getByRole('link',{name:'Urgent: 5'})).toHaveAttribute('href','/staff/tickets?statusGroup=active&itPriority=URGENT');
  expect(screen.getByText('No active Actions assigned to you.')).toBeInTheDocument();
 });
 it('shows real empty results with zero-count links',async()=>{
  vi.mocked(api.fetchRequesterDashboard).mockResolvedValue({...requester,metrics:{activeTickets:0,waitingForRequester:0,recentlyResolved:0},recentTickets:[],recentlyResolvedIncludesEstimates:false});
  render(<Dashboard staff={false} navigate={vi.fn()}/>);expect(await screen.findByText('No recent Tickets.')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Active Tickets 0'})).toBeInTheDocument();expect(screen.queryByText(/includes estimated/)).not.toBeInTheDocument();
 });
 it('does not fabricate zero data on failure, and supports explicit retry/refresh only',async()=>{
  vi.mocked(api.fetchRequesterDashboard).mockRejectedValueOnce(new Error('Unavailable'));
  render(<Dashboard staff={false} navigate={vi.fn()}/>);expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable');expect(screen.queryByRole('link')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));await screen.findByRole('link',{name:'Active Tickets 22'});expect(api.fetchRequesterDashboard).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button',{name:'Refresh Dashboard'}));await waitFor(()=>expect(api.fetchRequesterDashboard).toHaveBeenCalledTimes(3));
 });
 it.each([false,true])('retains the last successful metrics, previews, links and as-of after a failed refresh (staff=%s), then replaces them on retry',async isStaff=>{
  const read=isStaff?vi.mocked(api.fetchStaffDashboard):vi.mocked(api.fetchRequesterDashboard);
  render(<Dashboard staff={isStaff} navigate={vi.fn()}/>);
  const card=isStaff?'My Active Tickets 7':'Active Tickets 22';
  await screen.findByRole('link',{name:card});
  const asOf=screen.getByText(/As of /).textContent;
  const oldHref=screen.getByRole('link',{name:card}).getAttribute('href');
  read.mockRejectedValueOnce(Object.assign(new Error('Refresh unavailable'),{status:503}));
  fireEvent.click(screen.getByRole('button',{name:'Refresh Dashboard'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Refresh unavailable');
  expect(screen.getByRole('link',{name:card})).toHaveAttribute('href',oldHref);
  expect(screen.getByText(/As of /).textContent).toBe(asOf);
  expect(screen.getByRole('link',{name:'TKT-11: Keyboard issue'})).toBeInTheDocument();
  expect(screen.getByText(/Stale data/)).toBeInTheDocument();
  const replacement=isStaff?{...staff,asOf:'2026-10-29T01:00:00.000Z',metrics:{...staff.metrics,myTickets:8}}:{...requester,asOf:'2026-10-29T01:00:00.000Z',metrics:{...requester.metrics,activeTickets:23}};
  read.mockResolvedValueOnce(replacement as never);
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  await screen.findByRole('link',{name:isStaff?'My Active Tickets 8':'Active Tickets 23'});
  expect(screen.getByText(/As of /).textContent).not.toBe(asOf);
  expect(screen.queryByText(/Stale data/)).not.toBeInTheDocument();
 });
 it('retains the original resolution window on network failure and while retrying',async()=>{
  render(<Dashboard staff={false} navigate={vi.fn()}/>);await screen.findByRole('link',{name:'Active Tickets 22'});
  const original=screen.getByRole('link',{name:'Recently Resolved (Last 7 Calendar Dates) 0'}).getAttribute('href');
  vi.mocked(api.fetchRequesterDashboard).mockRejectedValueOnce(new TypeError('Network unavailable'));
  fireEvent.click(screen.getByRole('button',{name:'Refresh Dashboard'}));await screen.findByRole('alert');
  let finish!:(value:RequesterDashboard)=>void;vi.mocked(api.fetchRequesterDashboard).mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));
  expect(screen.getByText(/Stale data/)).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Recently Resolved (Last 7 Calendar Dates) 0'})).toHaveAttribute('href',original);
  await act(async()=>finish(requester));expect(screen.queryByText(/Stale data/)).not.toBeInTheDocument();
 });
 it('clears protected data and as-of after session failure rather than marking it stale',async()=>{
  render(<Dashboard staff={false} navigate={vi.fn()}/>);await screen.findByRole('link',{name:'Active Tickets 22'});
  vi.mocked(api.fetchRequesterDashboard).mockRejectedValueOnce(Object.assign(new Error('Session ended'),{status:401}));
  fireEvent.click(screen.getByRole('button',{name:'Refresh Dashboard'}));await screen.findByRole('alert');
  expect(screen.queryByRole('link')).not.toBeInTheDocument();expect(screen.queryByText(/As of /)).not.toBeInTheDocument();expect(screen.queryByText(/Stale data/)).not.toBeInTheDocument();
 });
 it('discards an old response after role/read changes even if abort is ignored',async()=>{
  let finish!:(d:RequesterDashboard)=>void;vi.mocked(api.fetchRequesterDashboard).mockReturnValue(new Promise(r=>{finish=r;}));
  const view=render(<Dashboard staff={false} navigate={vi.fn()}/>);view.rerender(<Dashboard staff navigate={vi.fn()}/>);
  await screen.findByRole('link',{name:'My Active Tickets 7'});await act(async()=>finish(requester));expect(screen.queryByRole('link',{name:'Active Tickets 22'})).not.toBeInTheDocument();
 });
 it('never retains a successful snapshot across a changed role scope',async()=>{
  const view=render(<Dashboard staff={false} navigate={vi.fn()}/>);await screen.findByRole('link',{name:'Active Tickets 22'});
  vi.mocked(api.fetchStaffDashboard).mockRejectedValueOnce(new Error('Staff read failed'));
  view.rerender(<Dashboard staff navigate={vi.fn()}/>);
  expect(screen.queryByRole('link',{name:'Active Tickets 22'})).not.toBeInTheDocument();
  await screen.findByRole('alert');expect(screen.queryByText(/As of /)).not.toBeInTheDocument();expect(screen.queryByText(/Stale data/)).not.toBeInTheDocument();
 });
 it('shows forbidden feedback and hides previous protected metrics on refresh failure',async()=>{
  render(<Dashboard staff navigate={vi.fn()}/>);await screen.findByRole('link',{name:'My Active Tickets 7'});
  vi.mocked(api.fetchStaffDashboard).mockRejectedValueOnce(Object.assign(new Error('Forbidden'),{status:403}));fireEvent.click(screen.getByRole('button',{name:'Refresh Dashboard'}));expect(await screen.findByRole('alert')).toHaveTextContent('Access denied (403)');expect(screen.queryByRole('link')).not.toBeInTheDocument();
 });
});
describe('My Active Actions',()=>{
 it('uses guarded page URL and action anchors with bounded next/previous navigation',async()=>{
  const action={id:41,ticketId:11,description:'Check network',status:'PLANNED',assignee:{id:5,name:'Staff A'},ticket:requester.recentTickets[0]} as ActionPreview;
  vi.mocked(api.fetchMyActions).mockResolvedValue({actions:[action],pagination:{page:2,limit:10,totalItems:21,totalPages:3}});
  const navigate=vi.fn();render(<MyActiveActions search='?assignee=me&statusGroup=active&page=2' navigate={navigate}/>);
  expect(await screen.findByRole('link',{name:'TKT-11: Check network'})).toHaveAttribute('href','/staff/tickets/11?actionId=41');expect(api.fetchMyActions).toHaveBeenCalledWith(2,expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button',{name:'Next page'}));expect(navigate).toHaveBeenCalledWith('/staff/actions?assignee=me&statusGroup=active&page=3');
 });
 it.each(['?assignee=1&statusGroup=active','?assignee=me&statusGroup=active&page=0','?assignee=me&statusGroup=active&x=1','?assignee=me&assignee=me&statusGroup=active'])('rejects malformed filters without a request: %s',search=>{
  render(<MyActiveActions search={search} navigate={vi.fn()}/>);expect(screen.getByRole('alert')).toHaveTextContent('Invalid action filters');expect(api.fetchMyActions).not.toHaveBeenCalled();
 });
});
