import { afterEach,describe,it,expect,vi } from 'vitest';
import { fetchRequesterDashboard,fetchStaffDashboard,fetchMyActions } from '../../src/dashboard-api.js';
import { ApiClientError } from '../../src/api.js';
afterEach(()=>vi.unstubAllGlobals());
describe('Dashboard HTTP client',()=>{
 it('uses credentialed abortable role reads and the exact assigned action filter',async()=>{
  const fetch=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({metrics:{}}),{status:200}));vi.stubGlobal('fetch',fetch);const c=new AbortController();
  await fetchRequesterDashboard(c.signal);await fetchStaffDashboard(c.signal);await fetchMyActions(2,c.signal);
  expect(fetch.mock.calls.map(c=>new URL(c[0]).pathname)).toEqual(['/api/dashboards/requester','/api/dashboards/staff','/api/staff/actions']);expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('assignee=me&statusGroup=active&page=2&limit=10'),expect.objectContaining({credentials:'include',signal:c.signal}));
 });
 it('forwards role errors safely without returning fabricated zero metrics',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'FORBIDDEN',message:'Access denied'}}),{status:403})));
  await expect(fetchStaffDashboard()).rejects.toMatchObject({status:403,code:'FORBIDDEN'});
 });
 it('dispatches session expiry for protected reads',async()=>{
  const expired=vi.fn();window.addEventListener('auth:expired',expired);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:401})));
  try{await expect(fetchRequesterDashboard()).rejects.toBeInstanceOf(ApiClientError);expect(expired).toHaveBeenCalledOnce();}finally{window.removeEventListener('auth:expired',expired);}
 });
});
