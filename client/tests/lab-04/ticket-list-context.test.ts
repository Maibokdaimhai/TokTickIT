import { describe,it,expect } from 'vitest';
import { ticketListState,ticketListReturn } from '../../src/utils/ticket-query.js';
const actor={id:7,role:'IT_STAFF'};
const state=(returnTo:string,userId=actor.id,role=actor.role)=>({ticketListContext:{userId,role,returnTo}});
describe('Reload-safe Ticket list context',()=>{
 it('keeps exact per-entry filters without storing them in a global browser cache',()=>{
  window.history.replaceState(null,'','/staff/tickets?owner=me&statusGroup=active&page=3');
  const saved=ticketListState(actor);window.history.pushState(saved,'','/staff/tickets/91');
  expect(ticketListReturn(actor)).toBe('/staff/tickets?owner=me&statusGroup=active&page=3');
 });
 it.each([
  state('/staff/tickets?page=2',8),state('/staff/tickets?page=2',7,'ADMINISTRATOR'),
  state('https://example.com/'),state('//example.com/'),state('/my-tickets?page=2'),
  state('/staff/tickets?status=OPEN&status=CLOSED'),state('/staff/tickets?page=0'),state('/staff/tickets#x'),null,
 ])('ignores invalid or cross-user/role return context: %j',saved=>{expect(ticketListReturn(actor,saved)).toBeNull();});
 it('does not accept a Staff return route for a Requester',()=>{expect(ticketListReturn({id:7,role:'REQUESTER'},state('/staff/tickets',7,'REQUESTER'))).toBeNull();});
});
