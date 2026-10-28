import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "../../server/node_modules/@prisma/client/index.js";
import bcrypt from "../../server/node_modules/bcrypt/bcrypt.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { assertSafeDatabaseUrl } from "../lab-03/db-guard.js";

assertSafeDatabaseUrl(process.env.DATABASE_URL, process.env.E2E_ALLOW_DB_WRITE);
const prisma = new PrismaClient(), password = process.env.E2E_INITIAL_PASSWORD;
if (!password) throw new Error("Supply a synthetic E2E_INITIAL_PASSWORD for disposable dashboard accounts");
test.afterAll(async()=>{await prisma.$disconnect();});
async function scenario() {
  const marker=randomUUID(),hash=await bcrypt.hash(password!,12);
  const user=(name:string,role:'REQUESTER'|'IT_STAFF'|'ADMINISTRATOR')=>prisma.user.create({data:{name,email:`${name.toLowerCase().replaceAll(' ','-')}-${marker}@dashboard-e2e.test`,role,passwordHash:hash,mustChangePassword:false}});
  const requester=await user('Dashboard Requester','REQUESTER'),other=await user('Other Requester','REQUESTER'),staff=await user('Dashboard Staff','IT_STAFF'),admin=await user('Dashboard Admin','ADMINISTRATOR');
  const category=await prisma.category.findFirstOrThrow({where:{isActive:true}}),system=await prisma.relatedSystem.findFirstOrThrow({where:{isActive:true}});
  const ticket=(requesterId:number,status:'OPEN'|'WAITING_FOR_REQUESTER'|'RESOLVED',suffix:string)=>prisma.ticket.create({data:{ticketNumber:`DASH-${suffix}-${marker}`,requesterId,summary:`Dashboard ${suffix} fixture`,description:'Disposable browser data',categoryId:category.id,relatedSystemId:system.id,requestedPriority:'HIGH',itPriority:'URGENT',status,ownerId:staff.id,createdAt:new Date('2026-01-01T00:00:00Z'),resolvedAt:status==='RESOLVED'?new Date():null,resolvedAtEstimated:status==='RESOLVED'}});
  const open=await ticket(requester.id,'OPEN','open'),waiting=await ticket(requester.id,'WAITING_FOR_REQUESTER','waiting'),resolved=await ticket(requester.id,'RESOLVED','resolved');await ticket(other.id,'OPEN','foreign');
  const actions=[];
  for(let i=0;i<12;i++)actions.push(await prisma.actionTaken.create({data:{ticketId:open.id,description:`Diagnostic work ${i}`,actionAt:new Date(),performedById:admin.id,assigneeId:staff.id,followUpRequired:false,status:'PLANNED',canonicalRequest:'{}',clientRequestId:randomUUID()}}));
  const adminAction=await prisma.actionTaken.create({data:{ticketId:open.id,description:'Administrator assigned work',actionAt:new Date(),performedById:staff.id,assigneeId:admin.id,followUpRequired:false,status:'IN_PROGRESS',canonicalRequest:'{}',clientRequestId:randomUUID()}});
  return {requester,other,staff,admin,open,waiting,resolved,actions,adminAction};
}
async function login(page:Page,email:string){await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password!);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Account menu'})).toBeVisible();}
async function capture(page:Page,role:string){
  fs.mkdirSync(`artifacts/lab-04/screenshots/${role}-dashboard`,{recursive:true});
  for(const width of [320,390,820,1440]){
    await page.setViewportSize({width,height:1000});
    const dashboard=page.getByRole('region',{name:role==='requester'?'Requester Dashboard':'Staff Dashboard'});
    await expect(dashboard).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    for(const element of await dashboard.locator('a,button,h1,h2').all()){
      if(!await element.isVisible())continue;const b=(await element.boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width+1);if(await element.evaluate(e=>e.matches('a,button')))expect(b.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({path:`artifacts/lab-04/screenshots/${role}-dashboard/dashboard-${width}.png`,fullPage:true});
  }
}
test('Requester dashboard counts and links survive filters, reload and Back without leaking another Requester',async({page})=>{
  const f=await scenario();await login(page,f.requester.email);await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link',{name:'Active Tickets 2',exact:true})).toBeVisible();await expect(page.getByText(/includes estimated legacy/)).toBeVisible();
  await expect(page.getByText(/foreign fixture/)).toHaveCount(0);
  const activeCard=page.getByRole('link',{name:'Active Tickets 2',exact:true});await activeCard.focus();await expect(activeCard).toBeFocused();await page.keyboard.press('Enter');await expect(page).toHaveURL(/statusGroup=active/);await page.goBack();await expect(activeCard).toBeVisible();
  await capture(page,'requester');
  await page.getByRole('link',{name:'Waiting for You 1',exact:true}).click();await expect(page).toHaveURL(/status=WAITING_FOR_REQUESTER/);await expect(page.getByTestId(`ticket-row-${f.waiting.id}`)).toBeVisible();await expect(page.getByTestId(`ticket-row-${f.open.id}`)).toHaveCount(0);
  await page.reload();await expect(page.getByLabel('Filter by status')).toHaveValue('WAITING_FOR_REQUESTER');await expect(page.getByTestId(`ticket-row-${f.waiting.id}`)).toBeVisible();
  await page.goBack();await expect(page.getByRole('heading',{name:'Requester Dashboard'})).toBeVisible();
  await page.getByRole('link',{name:'Recently Resolved (Last 7 Calendar Dates) 1',exact:true}).click();expect(new URL(page.url()).searchParams.get('resolvedFrom')).toBeTruthy();await expect(page.getByTestId(`ticket-row-${f.resolved.id}`)).toBeVisible();
  await page.goto('/staff/dashboard');await expect(page.getByTestId('route-forbidden')).toBeVisible();await page.getByRole('button',{name:'Return to Permitted Home'}).click();await expect(page.getByRole('heading',{name:'Requester Dashboard'})).toBeVisible();
});
test('Staff dashboard opens exact Ticket filters, paginated Actions and a selected Action beyond the first chronological page',async({page})=>{
  const f=await scenario();await login(page,f.staff.email);await expect(page).toHaveURL(/\/staff\/dashboard$/);await expect(page.getByRole('link',{name:'My Active Actions 12',exact:true})).toBeVisible();await capture(page,'staff');
  const target=f.actions[11];await page.getByRole('link',{name:`${f.open.ticketNumber}: ${target.description}`,exact:true}).click();await expect(page).toHaveURL(new RegExp(`actionId=${target.id}`));await expect(page.getByRole('article',{name:`Action #${target.id}`,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Dashboard',exact:true}).click();await page.getByRole('link',{name:'My Active Actions 12',exact:true}).click();await expect(page.getByText('12 active Actions assigned to you on active Tickets.')).toBeVisible();await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(page).toHaveURL(/page=2/);await expect(page.getByText('Page 2 of 2')).toBeVisible();await page.reload();await expect(page.getByText('Page 2 of 2')).toBeVisible();await page.goBack();await expect(page.getByText('Page 1 of 2')).toBeVisible();
  await page.getByRole('button',{name:'Dashboard',exact:true}).click();const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/staff/tickets');await page.getByRole('link',{name:/My Active Tickets \d+/}).click();const list=await response;expect(list.status()).toBe(200);expect(new URL(list.url()).searchParams.get('owner')).toBe('me');expect(new URL(list.url()).searchParams.get('statusGroup')).toBe('active');
  await expect(page.getByLabel('Filter by owner')).toHaveValue('me');await page.reload();await expect(page.getByLabel('Filter by owner')).toHaveValue('me');
});
test('Administrator uses its own assignments and retains management navigation',async({page})=>{
  const f=await scenario();await login(page,f.admin.email);await expect(page.getByRole('heading',{name:'Staff Dashboard'})).toBeVisible();await expect(page.getByRole('link',{name:'My Active Actions 1',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:`${f.open.ticketNumber}: Administrator assigned work`,exact:true})).toBeVisible();
  await page.getByTestId('nav-user-management').click();await expect(page.getByRole('heading',{name:'User Management',exact:true})).toBeVisible();await page.getByRole('button',{name:'TokTickIT Enterprise Service Desk'}).click();await expect(page.getByRole('heading',{name:'Staff Dashboard'})).toBeVisible();
});
