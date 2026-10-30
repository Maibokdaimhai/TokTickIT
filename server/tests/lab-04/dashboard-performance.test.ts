import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import os from "node:os";
import fs from "node:fs";
import { fixture } from "./fixture.js";

describe.skipIf(process.env.LAB4_DASHBOARD_PERF !== "1")("Opt-in dashboard performance smoke",()=>{
  let f:Awaited<ReturnType<typeof fixture>>, requester:number,staff:number,admin:number;
  beforeAll(async()=>{
    f=await fixture();requester=(await f.user('REQUESTER')).id;staff=(await f.user('IT_STAFF')).id;admin=(await f.user('ADMINISTRATOR')).id;
    const template=await f.ticket(requester);await f.prisma.ticket.delete({where:{id:template.id}});
    await f.prisma.$executeRaw`INSERT INTO "Ticket" ("ticketNumber","requesterId","categoryId","relatedSystemId",summary,description,"requestedPriority","itPriority",status,"ownerId","createdAt","updatedAt","resolvedAt")
      SELECT 'PERF-'||i,${requester},${template.categoryId},${template.relatedSystemId},'Representative dashboard fixture','Synthetic disposable data','MEDIUM'::"Priority",
      (ARRAY['LOW','MEDIUM','HIGH','URGENT']::"Priority"[])[1+i%4],(ARRAY['NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','RESOLVED','CLOSED','REOPENED','CANCELLED']::"TicketStatus"[])[1+i%8],
      CASE WHEN i%3=0 THEN NULL WHEN i%3=1 THEN ${staff} ELSE ${admin} END,now()-interval '10 days',now()-(i||' seconds')::interval,
      CASE WHEN i%8 IN (4,5) THEN now()-(i||' minutes')::interval ELSE NULL END FROM generate_series(1,10000) i`;
    await f.prisma.$executeRaw`INSERT INTO "ActionTaken" ("ticketId","performedById","assigneeId","actionAt",description,"followUpRequired",status,"clientRequestId","canonicalRequest","createdAt","updatedAt")
      SELECT t.id,${staff},CASE WHEN i%2=0 THEN ${staff} ELSE ${admin} END,now(),'Synthetic action',false,(ARRAY['PLANNED','IN_PROGRESS','COMPLETED']::"ActionStatus"[])[i],
      md5(t.id::text||':'||i)::uuid,'{}',now(),now() FROM "Ticket" t CROSS JOIN generate_series(1,3) i`;
    await f.prisma.$executeRawUnsafe('ANALYZE "Ticket"');await f.prisma.$executeRawUnsafe('ANALYZE "ActionTaken"');
  },60000);
  afterAll(async()=>{if(f)await f.close();});
  it('keeps p95 within 1000ms, payload within 64KiB and previews within five across 20 warm requests per role',async()=>{
    const runs=[];
    for(const [role,id,path] of [['REQUESTER',requester,'requester'],['IT_STAFF',staff,'staff'],['ADMINISTRATOR',admin,'staff']] as const){
      const a=await f.agent(id);expect((await a.get('/api/dashboards/'+path)).status).toBe(200);
      const latencies:number[]=[],sizes:number[]=[];
      for(let i=0;i<20;i++){
        const start=performance.now(),res=await a.get('/api/dashboards/'+path);latencies.push(performance.now()-start);
        expect(res.status).toBe(200);sizes.push(Buffer.byteLength(JSON.stringify(res.body),'utf8'));
        expect(res.body.recentTickets.length).toBeLessThanOrEqual(5);if(path==='staff')expect(res.body.myActions.length).toBeLessThanOrEqual(5);
      }
      const sorted=[...latencies].sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];
      expect(p95).toBeLessThanOrEqual(1000);expect(Math.max(...sizes)).toBeLessThanOrEqual(65536);
      runs.push({role,requests:20,p95Ms:Math.round(p95*100)/100,maxPayloadBytes:Math.max(...sizes)});
    }
    const plans={
      requester:await f.prisma.$queryRaw`EXPLAIN (ANALYZE,FORMAT JSON) SELECT count(*) FROM "Ticket" WHERE "requesterId"=${requester} AND status IN ('RESOLVED','CLOSED') AND "resolvedAt" BETWEEN now()-interval '7 days' AND now()`,
      myActions:await f.prisma.$queryRaw`EXPLAIN (ANALYZE,FORMAT JSON) SELECT a.id FROM "ActionTaken" a JOIN "Ticket" t ON t.id=a."ticketId" WHERE a."assigneeId"=${staff} AND a.status IN ('PLANNED','IN_PROGRESS') AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED') ORDER BY a."updatedAt" DESC,a.id ASC LIMIT 5`,
    };
    const versions=await f.prisma.$queryRaw<{version:string}[]>`SELECT version()`;
    const evidence={date:new Date().toISOString(),dataset:{tickets:await f.prisma.ticket.count(),actions:await f.prisma.actionTaken.count()},host:{platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,memoryGiB:Math.round(os.totalmem()/1024**3),node:process.version,postgres:versions[0].version},runs,plans,scope:'Disposable local performance smoke; no production-scale or final-main claim.'};
    if(process.env.LAB4_PERF_OUTPUT)fs.writeFileSync(process.env.LAB4_PERF_OUTPUT,JSON.stringify(evidence,null,2)+'\n');
  },60000);
});
