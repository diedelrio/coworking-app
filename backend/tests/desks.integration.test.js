// Creates and removes only a unique desk_test_* schema in a LOCAL PostgreSQL database.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {Client} = require('pg');
const crypto = require('node:crypto');
require('dotenv').config({quiet:true});

test('numbered desks: migration, API permissions, conflicts and transactional allocation', {timeout:120000}, async t => {
  const originalUrl = process.env.DESK_TEST_DATABASE_URL || process.env.DATABASE_URL;
  const url = new URL(originalUrl);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname), 'Integration tests require a local database');
  const schema = 'desk_test_' + crypto.randomBytes(8).toString('hex');
  const quotedSchema = '"' + schema + '"';
  const adminConnection = new Client({connectionString:originalUrl});
  let prisma, server;
  await adminConnection.connect();
  try {
    await adminConnection.query('CREATE SCHEMA ' + quotedSchema);
    const sql = execFileSync(process.execPath, [require.resolve('prisma/build/index.js'),'migrate','diff','--from-empty','--to-schema-datamodel',path.join(__dirname,'../prisma/schema.prisma'),'--script'], {encoding:'utf8'});
    await adminConnection.query('SET search_path TO ' + quotedSchema);
    await adminConnection.query(sql.replaceAll('"public"',quotedSchema));
    // Exercise the actual migration against the pre-feature table layout.
    await adminConnection.query('DROP TABLE "ReservationDesk", "FixedDeskAssignment", "Desk"; ALTER TABLE "Space" DROP COLUMN "numberedDesks"');
    await adminConnection.query(fs.readFileSync(path.join(__dirname,'../prisma/migrations/20260911120000_numbered_desks/migration.sql'),'utf8'));
    url.searchParams.set('schema',schema); process.env.DATABASE_URL = url.toString();
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    prisma = require('../src/prisma');
    const express = require('express');
    const jwt = require('jsonwebtoken');
    const app = express(); app.use(express.json());
    app.use('/spaces', require('../src/routes/spaces'));
    app.use('/reservations', require('../src/routes/reservations'));
    await new Promise(resolve => {server = app.listen(0,'127.0.0.1',resolve);});
    const base = 'http://127.0.0.1:' + server.address().port;
    const users = [];
    for(let i=0;i<5;i++) users.push(await prisma.user.create({data:{name:'Desk test',lastName:String(i),phone:'',email:'desk'+i+'@example.test',password:'unused',role:i===0?'ADMIN':'CLIENT'}}));
    const tokens = users.map(u => jwt.sign({userId:u.id,role:u.role},process.env.JWT_SECRET));
    async function request(method,route,body,actor=0) {
      const r = await fetch(base+route,{method,headers:{authorization:'Bearer '+tokens[actor],'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
      return {status:r.status,body:await r.json()};
    }
    function expect(result,status) {assert.equal(result.status,status,JSON.stringify(result.body));return result.body;}
    const future = new Date(); future.setDate(future.getDate()+35); while(future.getDay()!==1)future.setDate(future.getDate()+1);
    const date = [future.getFullYear(),String(future.getMonth()+1).padStart(2,'0'),String(future.getDate()).padStart(2,'0')].join('-');
    const later = new Date(future); later.setDate(later.getDate()+7);
    const nextDate = [later.getFullYear(),String(later.getMonth()+1).padStart(2,'0'),String(later.getDate()).padStart(2,'0')].join('-');
    const payload = (spaceId,extra={}) => ({spaceId,date,startTime:'09:00',endTime:'10:00',attendees:1,...extra});
    const availability = (id,extra='') => request('GET','/spaces/'+id+'/desks/availability?date='+date+'&startTime=09:00&endTime=10:00'+extra,undefined,1);
    const makeSpace = async (capacity=3) => expect(await request('POST','/spaces',{name:'Sinergia test',type:'FLEX_DESK',capacity,numberedDesks:true}),201);
    const listDesks = async id => expect(await request('GET','/spaces/'+id+'/desks'),200);
    let space, desks, fixedId, reservation;
    await t.test('space configuration creates numbered desks and private fixed assignments',async () => {
      space=await makeSpace(); desks=await listDesks(space.id); assert.deepEqual(desks.map(d=>d.number),[1,2,3]);
      const fixed=expect(await request('POST','/spaces/'+space.id+'/desks/'+desks[0].id+'/fixed',{occupantName:'Private occupant',startDate:date,endDate:date}),201); fixedId=fixed.id;
      const free=expect(await availability(space.id),200); assert.equal(free.available,2); assert.equal(free.desks[0].status,'FIXED'); assert.ok(!JSON.stringify(free).includes('Private occupant'));
      expect(await request('GET','/spaces/'+space.id+'/desks',undefined,1),403);
      expect(await request('POST','/spaces/'+space.id+'/desks/'+desks[0].id+'/fixed',{occupantName:'Another',startDate:date}),409);
      const next=expect(await request('GET','/spaces/'+space.id+'/desks/availability?date='+nextDate+'&startTime=09:00&endTime=10:00',undefined,1),200); assert.equal(next.available,3);
    });
    await t.test('admin must select free desks and cannot duplicate or use another space',async () => {
      expect(await request('POST','/reservations',payload(space.id)),400);
      expect(await request('POST','/reservations',payload(space.id,{deskIds:[desks[0].id]})),409);
      expect(await request('POST','/reservations',payload(space.id,{attendees:2,deskIds:[desks[1].id,desks[1].id]})),400);
      const other=await makeSpace(1), foreign=await listDesks(other.id);
      expect(await request('POST','/reservations',payload(space.id,{deskIds:[foreign[0].id]})),409);
      reservation=expect(await request('POST','/reservations',payload(space.id,{deskIds:[desks[1].id]})),201); assert.equal(reservation.desks[0].desk.number,2);
    });
    await t.test('client gets a free desk automatically, pending blocks, cancellation releases',async () => {
      const client=expect(await request('POST','/reservations',payload(space.id,{deskIds:[desks[0].id]}),1),201);
      assert.equal(client.status,'PENDING'); assert.equal(client.desks[0].desk.number,3);
      assert.equal(expect(await availability(space.id),200).available,0);
      expect(await request('PATCH','/reservations/'+client.id+'/cancel',{},1),200);
      assert.equal(expect(await availability(space.id),200).available,1);
      const mine=expect(await request('GET','/reservations/my',undefined,1),200); assert.ok(mine.some(r=>r.id===client.id && r.desks[0].desk.number===3));
    });
    await t.test('editing reassigns desks atomically and fixed assignments reject conflicts',async () => {
      const changed=expect(await request('PUT','/reservations/'+reservation.id,payload(space.id,{deskIds:[desks[2].id]})),200); assert.equal(changed.desks[0].desk.number,3);
      expect(await request('POST','/spaces/'+space.id+'/desks/'+desks[2].id+'/fixed',{occupantName:'Blocked',startDate:date}),409);
      expect(await request('PUT','/spaces/'+space.id+'/desks/'+desks[2].id,{active:false}),409);
      expect(await request('DELETE','/spaces/'+space.id+'/desks/'+desks[0].id+'/fixed/'+fixedId),200);
      assert.equal(expect(await availability(space.id),200).available,2);
    });
    await t.test('whole interval needs the same free desk; adjacent bookings do not overlap',async () => {
      const s=await makeSpace(2), ds=await listDesks(s.id);
      expect(await request('POST','/reservations',payload(s.id,{deskIds:[ds[0].id],userId:users[2].id})),201);
      expect(await request('POST','/reservations',payload(s.id,{startTime:'10:00',endTime:'11:00',deskIds:[ds[1].id],userId:users[2].id})),201);
      const all=expect(await request('GET','/spaces/'+s.id+'/desks/availability?date='+date+'&startTime=09:00&endTime=11:00',undefined,1),200);assert.equal(all.available,0);
      const adjacent=expect(await request('GET','/spaces/'+s.id+'/desks/availability?date='+date+'&startTime=10:00&endTime=11:00',undefined,1),200);assert.equal(adjacent.available,1);assert.equal(adjacent.desks[0].status,'FREE');
    });
    await t.test('two simultaneous requests cannot receive the last desk',async () => {
      const s=await makeSpace(1);
      const results=await Promise.all([request('POST','/reservations',payload(s.id),3),request('POST','/reservations',payload(s.id),4)]);
      assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
      assert.equal(await prisma.reservation.count({where:{spaceId:s.id}}),1);
    });
    await t.test('recurring conflicts roll back the whole series; successful series edits keep desk links',async () => {
      const s=await makeSpace(2), ds=await listDesks(s.id);
      expect(await request('POST','/spaces/'+s.id+'/desks/'+ds[0].id+'/fixed',{occupantName:'Later',startDate:nextDate,endDate:nextDate}),201);
      expect(await request('POST','/reservations',payload(s.id,{deskIds:[ds[0].id],userId:users[4].id,recurrenceEnabled:true,recurrencePattern:'WEEKLY',recurrenceCount:2})),409);
      assert.equal(await prisma.reservation.count({where:{spaceId:s.id}}),0);
      const series=expect(await request('POST','/reservations',payload(s.id,{deskIds:[ds[1].id],userId:users[4].id,recurrenceEnabled:true,recurrencePattern:'WEEKLY',recurrenceCount:2})),201);
      assert.equal(series.createdCount,2);
      const changed=expect(await request('PUT','/reservations/'+series.first.id,payload(s.id,{startTime:'11:00',endTime:'12:00',deskIds:[ds[1].id],applyTo:'SERIES'})),200);
      assert.equal(changed.updatedCount,2);assert.equal(changed.first.desks[0].deskId,ds[1].id);
    });
    await t.test('weekly edits regenerate daily dates, preserve desks and roll back conflicts', async () => {
      const s = await makeSpace(2), ds = await listDesks(s.id);
      const dailyUser = await prisma.user.create({data:{name:'Daily',lastName:'Test',email:'daily@example.test',password:'unused',role:'CLIENT'}});
      const options = { startTime:'13:00', endTime:'14:00', userId:dailyUser.id, deskIds:[ds[0].id], recurrenceEnabled:true, recurrencePattern:'WEEKLY', recurrenceCount:4 };
      const series = expect(await request('POST','/reservations',payload(s.id,options)),201);
      const daily = {...options, recurrencePattern:'DAILY', applyTo:'SERIES'};
      expect(await request('PUT','/reservations/'+series.first.id,payload(s.id,{...daily,applyTo:'ONE'})),400);
      const updated = expect(await request('PUT','/reservations/'+series.first.id,payload(s.id,daily)),200);
      assert.equal(updated.updatedCount,4);
      let rows = await prisma.reservation.findMany({where:{seriesId:series.seriesId,status:'ACTIVE'},orderBy:{startTime:'asc'},include:{desks:true}});
      assert.ok(rows.every(r=>r.recurrencePattern==='DAILY' && r.desks[0].deskId===ds[0].id));
      assert.equal(rows[1].startTime.getTime()-rows[0].startTime.getTime(),86400000);
      const nextDay = rows[1].startTime.toISOString().slice(0,10);
      const avail = expect(await request('GET','/spaces/'+s.id+'/desks/availability?date='+nextDay+'&startTime=13:00&endTime=14:00',undefined,1),200);
      assert.equal(avail.desks.find(d=>d.id===ds[0].id).status,'OCCUPIED');
      const {recurrenceCount,...byDate}=daily;
      const expanded=expect(await request('PUT','/reservations/'+series.first.id,payload(s.id,{...byDate,recurrenceEndDate:nextDate})),200);
      assert.equal(expanded.updatedCount,6);
      rows=await prisma.reservation.findMany({where:{seriesId:series.seriesId,status:'ACTIVE'},orderBy:{startTime:'asc'},include:{desks:true}});
      assert.ok(rows.every(r=>r.desks[0].deskId===ds[0].id));
      expect(await request('POST','/spaces/'+s.id+'/desks/'+ds[1].id+'/fixed',{occupantName:'New date conflict',startDate:nextDay,endDate:nextDay}),201);
      const snapshot=rows.map(r=>[r.id,r.startTime.toISOString(),r.recurrenceCount]);
      expect(await request('PUT','/reservations/'+series.first.id,payload(s.id,{...daily,deskIds:[ds[1].id]})),409);
      const unchanged=await prisma.reservation.findMany({where:{seriesId:series.seriesId,status:'ACTIVE'},orderBy:{startTime:'asc'}});
      assert.deepEqual(unchanged.map(r=>[r.id,r.startTime.toISOString(),r.recurrenceCount]),snapshot);
    });
    await t.test('activation backfills existing reservations and rejects incompatible capacity atomically',async () => {
      const s=expect(await request('POST','/spaces',{name:'Legacy',type:'FLEX_DESK',capacity:2}),201);
      const {madridDateTimeToUtc,madridDateYMDToUtcMidnight}=require('../src/utils/timezone');
      const old=await prisma.reservation.create({data:{spaceId:s.id,userId:users[1].id,date:madridDateYMDToUtcMidnight(date),startTime:madridDateTimeToUtc(date,'09:00'),endTime:madridDateTimeToUtc(date,'10:00'),attendees:2}});
      expect(await request('PUT','/spaces/'+s.id,{...s,numberedDesks:true,capacity:1}),409);
      assert.equal((await prisma.space.findUnique({where:{id:s.id}})).numberedDesks,false);
      assert.equal(await prisma.desk.count({where:{spaceId:s.id}}),0);
      expect(await request('PUT','/spaces/'+s.id,{...s,numberedDesks:true}),200);
      assert.equal(await prisma.reservationDesk.count({where:{reservationId:old.id}}),2);
    });
    await t.test('availability validates dates and ownership; inventory updates remain consistent',async () => {
      expect(await request('GET','/spaces/'+space.id+'/desks/availability?date=2099-02-31&startTime=09:00&endTime=10:00',undefined,1),400);
      expect(await availability(space.id,'&excludeReservationId='+reservation.id),403);
      const s=await makeSpace(2), ds=await listDesks(s.id);
      expect(await request('PUT','/spaces/'+s.id+'/desks/'+ds[0].id,{number:ds[1].number}),409);
      expect(await request('PUT','/spaces/'+s.id+'/desks/'+ds[0].id,{active:false}),200);
      assert.equal((await prisma.space.findUnique({where:{id:s.id}})).capacity,1);
      expect(await request('PUT','/spaces/'+s.id+'/desks/'+ds[0].id,{active:true,number:10}),200);
      assert.equal((await prisma.space.findUnique({where:{id:s.id}})).capacity,2);
    });
  } finally {
    if(server) await new Promise(resolve => server.close(resolve));
    if(prisma) await prisma.$disconnect();
    assert.match(schema,/^desk_test_[a-f0-9]{16}$/);
    await adminConnection.query('DROP SCHEMA IF EXISTS ' + quotedSchema + ' CASCADE');
    await adminConnection.end();
  }
});
