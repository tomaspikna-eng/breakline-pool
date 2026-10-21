
/**
 * BREAKLINE Physics Lab 0.3
 * This is an intentionally simplified 2D rigid-body prototype in SI units.
 * It is NOT a validated pool simulation (no spin, slip/roll or jaw model yet).
 */
export const SPEC = Object.freeze({
  length: 2.54, width: 1.27,
  ballR: 0.028575, // WPA diameter 57.15 mm
  ballMass: 0.17,
  restitutionBall: 0.94,
  restitutionRail: 0.78,
  slidingFriction: 0.20,
  rollingFriction: 0.014,
  sidespinDamping: 0.65,
  sleepSpeed: 0.015,
  fixedDt: 1 / 240
});

const { length: L, width: W, ballR: R } = SPEC;

// Prototype sensor radii; real pocket jaws and openings require 3D collision geometry.
// Corner mouth preview 115 mm, side mouth preview 128 mm.
export const POCKETS = Object.freeze([
  { x: -L/2, z: -W/2, r: 0.0575 },
  { x:  0,   z: -W/2, r: 0.064 },
  { x:  L/2, z: -W/2, r: 0.0575 },
  { x: -L/2, z:  W/2, r: 0.0575 },
  { x:  0,   z:  W/2, r: 0.064 },
  { x:  L/2, z:  W/2, r: 0.0575 }
]);

function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296);
}

function shuffle(input, rnd) {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createRack(seed = 8) {
  const rnd = rand(seed);
  const solids = shuffle([1,2,3,4,5,6,7], rnd);
  const stripes = shuffle([9,10,11,12,13,14,15], rnd);
  const numbers = new Array(15);
  // WPA 8-ball style: 8 at the center, one of each group at rear corners.
  numbers[4] = 8;
  numbers[10] = solids.pop();
  numbers[14] = stripes.pop();
  const remaining = shuffle([...solids, ...stripes], rnd);
  for (let i = 0; i < 15; i++) if (!numbers[i]) numbers[i] = remaining.pop();
  const balls = [{ id: 0, x: -0.64, z: 0, vx: 0, vz: 0, active: true }];
  let index = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      balls.push({
        id: numbers[index++],
        x: 0.52 + row * Math.sqrt(3) * R + row * 0.00022,
        z: (col - row / 2) * (2 * R + 0.0003),
        vx: 0, vz: 0, active: true
      });
    }
  }
  return balls;
}

export function moving(balls) {
  return balls.some(b => b.active && (Math.abs(b.vx) > 0 || Math.abs(b.vz) > 0));
}

// The normalized cue tip offset is relative to the face of the white ball:
// x = left/right English, y = draw/follow. The spin model is provisional.
export function strike(balls, angle, powerPercent, contact = { x: 0, y: 0 }) {
  if (moving(balls)) return false;
  const cue = balls.find(b => b.id === 0 && b.active);
  if (!cue) return false;
  const power = Math.max(1, Math.min(100, powerPercent));
  const speed = 0.25 + power / 100 * 5.6;
  const dx = Math.cos(angle), dz = Math.sin(angle);
  cue.vx = dx * speed;
  cue.vz = dz * speed;
  const tipX = Math.max(-.85, Math.min(.85, Number(contact?.x) || 0));
  const tipY = Math.max(-.85, Math.min(.85, Number(contact?.y) || 0));
  // Center hit initially slides; high hit follows; low hit draws.
  cue.wx = dz * speed * tipY * 2.3 / R;
  cue.wz = -dx * speed * tipY * 2.3 / R;
  cue.wy = -tipX * speed * 13 / R;
  return true;
}

function potOrRail(b) {
  // Simplified sink areas. Exact pocket jaws are a later milestone.
  for (const p of POCKETS) {
    if (Math.hypot(b.x - p.x, b.z - p.z) < p.r) {
      b.active = false;
      b.vx = b.vz = 0;
      return;
    }
  }
  const xmax = L/2 - R;
  const zmax = W/2 - R;
  // Cushion response uses a small component of vertical-axis spin.
  // This is NOT yet a measured cushion-contact model.
  const english = (b.wy || 0) * R * .055;
  if (b.x < -xmax) { b.x = -xmax; b.vx = Math.abs(b.vx) * SPEC.restitutionRail; b.vz -= english; b.wy *= .70; }
  if (b.x >  xmax) { b.x =  xmax; b.vx = -Math.abs(b.vx) * SPEC.restitutionRail; b.vz += english; b.wy *= .70; }
  if (b.z < -zmax) { b.z = -zmax; b.vz = Math.abs(b.vz) * SPEC.restitutionRail; b.vx += english; b.wy *= .70; }
  if (b.z >  zmax) { b.z =  zmax; b.vz = -Math.abs(b.vz) * SPEC.restitutionRail; b.vx -= english; b.wy *= .70; }
}

function clothFriction(b, dt) {
  b.wx ??= 0;
  b.wy ??= 0;
  b.wz ??= 0;
  const slipX = b.vx + R * b.wz;
  const slipZ = b.vz - R * b.wx;
  const slip = Math.hypot(slipX, slipZ);
  const g = 9.81;
  if (slip > .008) {
    // Homogeneous sphere I=2/5 mr²; kinetic friction transforms slide to roll.
    const a = Math.min(SPEC.slidingFriction * g, slip / (3.5 * dt));
    const ax = -a * slipX / slip;
    const az = -a * slipZ / slip;
    b.vx += ax * dt;
    b.vz += az * dt;
    b.wx -= 2.5 * az * dt / R;
    b.wz += 2.5 * ax * dt / R;
  } else {
    const speed = Math.hypot(b.vx, b.vz);
    const next = Math.max(0, speed - SPEC.rollingFriction * g * dt);
    const scale = speed > 0 ? next / speed : 0;
    b.vx *= scale;
    b.vz *= scale;
    b.wx = b.vz / R;
    b.wz = -b.vx / R;
  }
  b.wy *= Math.exp(-SPEC.sidespinDamping * dt);
  if (Math.hypot(b.vx, b.vz) < SPEC.sleepSpeed &&
      Math.hypot(b.wx, b.wz) * R < SPEC.sleepSpeed) {
    b.vx = b.vz = b.wx = b.wz = 0;
  }
}

export function step(balls, dt = SPEC.fixedDt) {
  for (const b of balls) {
    if (!b.active) continue;
    clothFriction(b, dt);
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    potOrRail(b);
  }
  const minDist = 2 * R;
  const minSq = minDist * minDist;
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (!a.active) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (!b.active) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minSq) continue;
      const dist = Math.sqrt(distSq);
      // Non-random fallback avoids NaN for coincident centers.
      const nx = dist > 1e-10 ? dx / dist : 1;
      const nz = dist > 1e-10 ? dz / dist : 0;
      const penetration = minDist - dist;
      a.x -= nx * penetration * 0.5; a.z -= nz * penetration * 0.5;
      b.x += nx * penetration * 0.5; b.z += nz * penetration * 0.5;
      const relativeNormal = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (relativeNormal >= 0) continue;
      const impulse = -(1 + SPEC.restitutionBall) * relativeNormal / 2;
      a.vx -= impulse * nx; a.vz -= impulse * nz;
      b.vx += impulse * nx; b.vz += impulse * nz;
    }
  }
}
