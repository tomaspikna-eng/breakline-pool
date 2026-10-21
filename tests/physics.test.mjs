import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEC, POCKETS, createRack, moving, strike, step } from '../src/physics.mjs';

test('8-ball rack has cue + 15 uniquely numbered object balls', () => {
  const balls = createRack(42);
  assert.equal(balls.length, 16);
  assert.deepEqual([...balls.map(b=>b.id)].sort((a,b)=>a-b), Array.from({length:16},(_,i)=>i));
  const eight=balls.find(b=>b.id===8);
  assert.ok(eight.x > 0);
  assert.ok(eight.active);
});

test('rack is deterministic for a seed and fits playing surface', () => {
  assert.deepEqual(createRack(1234),createRack(1234));
  const balls=createRack(1234);
  for(const b of balls){
    assert.ok(Math.abs(b.x)+SPEC.ballR < SPEC.length/2);
    assert.ok(Math.abs(b.z)+SPEC.ballR < SPEC.width/2);
  }
});

test('strike generates velocity only when the table is at rest', () => {
  const balls=createRack();
  assert.equal(moving(balls),false);
  assert.equal(strike(balls,0,50),true);
  assert.ok(balls[0].vx>0);
  assert.equal(strike(balls,0,50),false);
});

test('a resting ball does not accelerate spontaneously', () => {
  const balls=[{id:0,x:0,z:0,vx:0,vz:0,active:true}];
  for(let i=0;i<100;i++)step(balls);
  assert.equal(balls[0].vx,0);
  assert.equal(balls[0].vz,0);
});

test('head-on collision transfers forward momentum', () => {
  const r=SPEC.ballR;
  const balls=[
    {id:0,x:-r*2.1,z:0,vx:1,vz:0,active:true},
    {id:1,x:0,z:0,vx:0,vz:0,active:true}
  ];
  for(let i=0;i<15;i++)step(balls);
  assert.ok(balls[1].vx>0,'target ball should move forward');
  assert.ok(balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.vx)));
});

test('pocket sensor marks ball inactive', () => {
  const p=POCKETS[0];
  const balls=[{id:1,x:p.x,z:p.z,vx:0,vz:0,active:true}];
  step(balls);
  assert.equal(balls[0].active,false);
});


test('regulation-sized balls remain unchanged', () => {
  assert.equal(SPEC.ballR * 2, 0.05715);
});

test('pocket preview mouth matches smaller target dimensions', () => {
  const corners = POCKETS.filter(p => Math.abs(p.x) > 0.01);
  const sides = POCKETS.filter(p => Math.abs(p.x) < 0.01);
  assert.equal(corners.length, 4);
  assert.equal(sides.length, 2);
  assert.ok(corners.every(p => Math.abs(p.r * 2 - .115) < 1e-10));
  assert.ok(sides.every(p => Math.abs(p.r * 2 - .128) < 1e-10));
});
