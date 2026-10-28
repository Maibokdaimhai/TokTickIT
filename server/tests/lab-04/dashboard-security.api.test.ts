import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../../src/app.js";
import { fixture } from "./fixture.js";

describe("Dashboard security and snapshot", () => {
  let f: Awaited<ReturnType<typeof fixture>>;
  beforeAll(async()=>{f=await fixture();},30000);afterAll(async()=>{if(f)await f.close();});
  it("requires a full active session and role before parsing input", async()=>{
    expect((await request(app).get("/api/dashboards/requester")).status).toBe(401);
    for(const role of ["REQUESTER","IT_STAFF","ADMINISTRATOR"] as const){
      const u=await f.user(role),a=await f.agent(u.id);
      expect((await a.get("/api/dashboards/requester?spoof=1")).status).toBe(role==="REQUESTER"?400:403);
      expect((await a.get("/api/dashboards/staff?spoof=1")).status).toBe(role==="REQUESTER"?403:400);
      expect((await a.get("/api/staff/actions?assignee=me&statusGroup=active")).status).toBe(role==="REQUESTER"?403:200);
      await f.prisma.user.update({where:{id:u.id},data:{mustChangePassword:true}});
      expect((await a.get(role==="REQUESTER"?"/api/dashboards/requester":"/api/dashboards/staff")).status).toBe(403);
      await f.prisma.user.update({where:{id:u.id},data:{isActive:false}});
      expect((await a.get("/api/dashboards/staff")).status).toBe(401);
    }
  });
  it("rejects scope spoofing, returns no-store, and turns DB failures into safe errors",async()=>{
    const a=await f.agent((await f.user("REQUESTER")).id);
    for(const q of ["requesterId=1","assignee=me","page=1","asOf=2026-01-01","x=1&x=2"]) expect((await a.get("/api/dashboards/requester?"+q)).status).toBe(400);
    expect((await a.get("/api/dashboards/requester")).headers['cache-control']).toBe('no-store');
    const spy=vi.spyOn(f.prisma,'$transaction').mockRejectedValueOnce(new Error('private database path and secret'));
    const failed=await a.get("/api/dashboards/requester");expect(failed.status).toBe(500);expect(JSON.stringify(failed.body)).not.toMatch(/secret|private|metrics/);spy.mockRestore();
  });
  it("keeps counts and previews on one real repeatable-read snapshot across a concurrent commit",async()=>{
    const u=await f.user("REQUESTER"),a=await f.agent(u.id);
    await f.ticket(u.id,{status:"OPEN"});
    const external=new PrismaClient({datasources:{db:{url:f.url.toString()}}});
    const transaction=f.prisma.$transaction.bind(f.prisma);
    const spy=vi.spyOn(f.prisma,'$transaction').mockImplementationOnce(((fn:any,options:any)=>transaction(async(tx:any)=>{
      const count=tx.ticket.count.bind(tx.ticket);
      vi.spyOn(tx.ticket,'count').mockImplementation(count).mockImplementationOnce(async(args:any)=>{
        const n=await count(args); // establishes the actual PostgreSQL snapshot
        const t=await tx.ticket.findFirstOrThrow({where:{requesterId:u.id}});
        await external.ticket.update({where:{id:t.id},data:{status:"WAITING_FOR_REQUESTER"}});
        return n;
      });
      return fn(tx);
    },options)) as any);
    try {
      const res=await a.get("/api/dashboards/requester");expect(res.status).toBe(200);
      expect(res.body.metrics).toEqual({activeTickets:1,waitingForRequester:0,recentlyResolved:0});
      expect(res.body.recentTickets[0].status).toBe("OPEN");
      spy.mockRestore();
      expect((await a.get("/api/dashboards/requester")).body.metrics.waitingForRequester).toBe(1);
    } finally {spy.mockRestore();await external.$disconnect();}
  });
});
