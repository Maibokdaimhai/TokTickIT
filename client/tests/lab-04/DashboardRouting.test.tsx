import React from 'react';
import { beforeEach,describe,it,expect,vi } from 'vitest';
import { render,screen,fireEvent,waitFor,act } from '@testing-library/react';
import App from '../../src/App.js';
import * as shared from '../../src/api.js';
import * as api from '../../src/dashboard-api.js';
import type { AuthResult,RequesterDashboard,StaffDashboard } from '../../src/types.js';
// Isolate Detail rendering here; the actual routing and both Ticket lists are exercised.
vi.mock('../../src/components/StaffTicketDetail.js',()=>({StaffTicketDetail:({onBack}:{onBack:()=>void})=><button onClick={onBack}>Back from Staff Detail</button>}));
vi.mock('../../src/components/TicketDetailPage.js',()=>({TicketDetailPage:({onBack}:{onBack:()=>void})=><button onClick={onBack}>Back from Requester Detail</button>}));
vi.mock('../../src/api.js',async original=>({...await original<typeof shared>(),getSession:vi.fn(),fetchMyTickets:vi.fn(),fetchStaffTickets:vi.fn(),fetchCategories:vi.fn().mockResolvedValue([]),fetchEligibleOwners:vi.fn().mockResolvedValue({owners:[]}),fetchAdminUsers:vi.fn().mockResolvedValue({users:[]})}));
vi.mock('../../src/dashboard-api.js',()=>({fetchRequesterDashboard:vi.fn(),fetchStaffDashboard:vi.fn(),fetchMyActions:vi.fn()}));
const windowData={asOf:'2026-10-28T01:00:00.000Z',windowStart:'2026-10-21T17:00:00.000Z',timeZone:'Asia/Bangkok' as const};
const requester:RequesterDashboard={...windowData,metrics:{activeTickets:0,waitingForRequester:0,recentlyResolved:0},recentlyResolvedIncludesEstimates:false,recentTickets:[]};
const staff:StaffDashboard={...windowData,metrics:{unassignedTickets:0,myTickets:0,myActiveActions:0},byStatus:{NEW:0,OPEN:0,IN_PROGRESS:0,WAITING_FOR_REQUESTER:0,RESOLVED:0,CLOSED:0,REOPENED:0,CANCELLED:0},byItPriority:{URGENT:0,HIGH:0,MEDIUM:0,LOW:0},recentTickets:[],myActions:[]};
function session(role:'REQUESTER'|'IT_STAFF'|'ADMINISTRATOR',mustChangePassword=false){return {user:{id:1,name:'Test User',email:'test@example.com',role,isActive:true},mustChangePassword} as AuthResult;}
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.fetchRequesterDashboard).mockResolvedValue(requester);vi.mocked(api.fetchStaffDashboard).mockResolvedValue(staff);const page={tickets:[],pagination:{page:1,limit:10,totalItems:0,totalPages:0}};vi.mocked(shared.fetchMyTickets).mockResolvedValue(page);vi.mocked(shared.fetchStaffTickets).mockResolvedValue(page);});
describe('Dashboard route integration',()=>{
 it.each(['REQUESTER','IT_STAFF','ADMINISTRATOR'] as const)('makes %s default and brand home its permitted Dashboard',async role=>{
  vi.mocked(shared.getSession).mockResolvedValue(session(role));window.history.replaceState(null,'','/');render(<App/>);
  expect(await screen.findByRole('heading',{name:role==='REQUESTER'?'Requester Dashboard':'Staff Dashboard'})).toBeInTheDocument();expect(window.location.pathname).toBe(role==='REQUESTER'?'/dashboard':'/staff/dashboard');
  expect(screen.getByRole('button',{name:'Dashboard'})).toHaveAttribute('aria-current','page');
  if(role==='ADMINISTRATOR')expect(screen.getByTestId('nav-user-management')).toBeInTheDocument();
 });
 it('preserves required password change before Dashboard',async()=>{
  vi.mocked(shared.getSession).mockResolvedValue(session('IT_STAFF',true));window.history.replaceState(null,'','/');render(<App/>);await waitFor(()=>expect(window.location.pathname).toBe('/change-password'));expect(api.fetchStaffDashboard).not.toHaveBeenCalled();
 });
 it.each([['REQUESTER','/staff/dashboard'],['IT_STAFF','/dashboard'],['REQUESTER','/staff/actions?assignee=me&statusGroup=active']] as const)('denies %s at %s and returns to permitted Dashboard',async(role,path)=>{
  vi.mocked(shared.getSession).mockResolvedValue(session(role));window.history.replaceState(null,'',path);render(<App/>);expect(await screen.findByTestId('route-forbidden')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Return to Permitted Home'}));await screen.findByRole('heading',{name:role==='REQUESTER'?'Requester Dashboard':'Staff Dashboard'});
 });
 it('opens a card with exact filters, restores URL filters after Back/reload and clears them explicitly',async()=>{
  vi.mocked(shared.getSession).mockResolvedValue(session('REQUESTER'));window.history.replaceState(null,'','/dashboard');const view=render(<App/>);
  fireEvent.click(await screen.findByRole('link',{name:'Active Tickets 0'}));await waitFor(()=>expect(shared.fetchMyTickets).toHaveBeenLastCalledWith(expect.objectContaining({statusGroup:'active'})));expect(window.location.pathname).toBe('/my-tickets');expect(window.location.search).toContain('statusGroup=active');
  view.unmount();vi.mocked(shared.fetchMyTickets).mockClear();
  let restoreSession!:(value:AuthResult)=>void;
  vi.mocked(shared.getSession).mockReturnValueOnce(new Promise(resolve=>{restoreSession=resolve;}));
  render(<App/>);expect(screen.getByRole('status')).toHaveTextContent('Checking session');
  await act(async()=>restoreSession(session('REQUESTER')));
  await screen.findByRole('combobox',{name:'Filter by status'});
  await waitFor(()=>expect(shared.fetchMyTickets).toHaveBeenLastCalledWith(expect.objectContaining({statusGroup:'active'})));
  fireEvent.click(screen.getByRole('button',{name:'Dashboard'}));await screen.findByRole('heading',{name:'Requester Dashboard'});
  await act(async()=>{window.history.pushState(null,'','/my-tickets?status=WAITING_FOR_REQUESTER&sort=updatedAt_desc');window.dispatchEvent(new PopStateEvent('popstate'));});
  await waitFor(()=>expect(shared.fetchMyTickets).toHaveBeenLastCalledWith(expect.objectContaining({status:'WAITING_FOR_REQUESTER',sort:'updatedAt_desc'})));
  await screen.findByTestId('no-results-state');
  fireEvent.click(await screen.findByRole('button',{name:'Clear All Filters'}));await waitFor(()=>expect(shared.fetchMyTickets).toHaveBeenLastCalledWith(expect.objectContaining({status:undefined,statusGroup:undefined,resolvedFrom:undefined})));
 });
 it('forwards Staff drill-down filters immediately and does not lose them on a filter change',async()=>{
  vi.mocked(shared.getSession).mockResolvedValue(session('ADMINISTRATOR'));window.history.replaceState(null,'','/staff/tickets?statusGroup=active&owner=me&itPriority=URGENT');render(<App/>);
  await waitFor(()=>expect(shared.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({statusGroup:'active',owner:'me',itPriority:'URGENT'})));
  fireEvent.change(screen.getByLabelText('Sort queue'),{target:{value:'createdAt_asc'}});await waitFor(()=>expect(shared.fetchStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({statusGroup:'active',owner:'me',itPriority:'URGENT',sort:'createdAt_asc'})));
 });
 it('rejects unknown or duplicate URL filters without silently showing an unfiltered list',async()=>{
  vi.mocked(shared.getSession).mockResolvedValue(session('REQUESTER'));window.history.replaceState(null,'','/my-tickets?status=OPEN&status=CLOSED');render(<App/>);expect(await screen.findByRole('alert')).toHaveTextContent('Invalid Ticket filters');expect(shared.fetchMyTickets).not.toHaveBeenCalled();
 });
 it.each(['REQUESTER','IT_STAFF'] as const)('preserves the exact %s list filters and page after a Detail reload',async role=>{
  const isStaff=role==='IT_STAFF',path=isStaff?'/staff/tickets':'/my-tickets';
  const query=isStaff?'?statusGroup=active&owner=me&itPriority=URGENT&page=2&sort=updatedAt_desc':'?status=WAITING_FOR_REQUESTER&priority=HIGH&page=2&sort=updatedAt_desc';
  vi.mocked(shared.getSession).mockResolvedValue(session(role));
  const ticket={id:77,ticketNumber:'TKT-77',summary:'Saved context',status:'WAITING_FOR_REQUESTER',requestedPriority:'HIGH',itPriority:'URGENT',category:{id:1,name:'Network'},relatedSystem:{id:1,name:'VPN'},owner:null,createdAt:windowData.asOf,updatedAt:windowData.asOf,attachmentCount:0,publicCommentCount:0,version:0};
  const response={tickets:[ticket],pagination:{page:2,limit:10,totalItems:12,totalPages:2}};
  const fetchList=isStaff?vi.mocked(shared.fetchStaffTickets):vi.mocked(shared.fetchMyTickets);
  fetchList.mockResolvedValue(response as never);window.history.replaceState(null,'',path+query);
  const view=render(<App/>);
  if(isStaff)fireEvent.click(await screen.findAllByRole('button',{name:'Open ticket TKT-77'}).then(buttons=>buttons[0]));
  else fireEvent.click(await screen.findByTestId('ticket-row-77'));
  const backLabel=isStaff?'Back from Staff Detail':'Back from Requester Detail';
  await screen.findByRole('button',{name:backLabel});
  expect(window.location.pathname).toBe(isStaff?'/staff/tickets/77':'/tickets/77');
  // A reload reconstructs React state but retains this history entry and its state.
  view.unmount();fetchList.mockClear();render(<App/>);
  fireEvent.click(await screen.findByRole('button',{name:backLabel}));
  await waitFor(()=>expect(fetchList).toHaveBeenCalledWith(expect.objectContaining({page:2,sort:'updatedAt_desc',...(isStaff?{owner:'me',itPriority:'URGENT',statusGroup:'active'}:{status:'WAITING_FOR_REQUESTER',priority:'HIGH'})})));
  const actual=new URLSearchParams(window.location.search);
  for(const [key,value] of new URLSearchParams(query))expect(actual.get(key)).toBe(value);
 });

});
