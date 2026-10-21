
import { SPEC, POCKETS, createRack, strike, step, moving } from './physics.mjs?v=0.3.0';

const B = window.BABYLON;
const $ = id => document.getElementById(id);
const canvas = $('game');
const state = { balls: createRack(8), angle: 0, pull: 0, contact: {x:0,y:0}, top: true, accumulator: 0, wasMoving: false, drag: null };
const colors = [
  '#eeeee8', '#f4c92f', '#1958a7', '#be2e37', '#673c89',
  '#e9851c', '#24835d', '#8b313a', '#161b20', '#f4c92f',
  '#1958a7', '#be2e37', '#673c89', '#e9851c', '#24835d', '#8b313a'
];

if (!B) {
  $('status').textContent = 'Nepodarilo sa načítať Babylon.js. Skontroluj internetové pripojenie.';
  throw new Error('Babylon.js CDN unavailable');
}

const engine = new B.Engine(canvas, true, { antialias: true, stencil: true });
const scene = new B.Scene(engine);
scene.clearColor = new B.Color4(0.055, 0.09, 0.11, 1);
const V = (x, y, z) => new B.Vector3(x, y, z);
const camera = new B.ArcRotateCamera('camera', -Math.PI/2, 0.08, 3.12, V(0,0,0), scene);
camera.lowerRadiusLimit = 1.8;
camera.upperRadiusLimit = 7;
camera.minZ = 0.01;
camera.fov = 0.57;
scene.activeCamera = camera;

const ambient = new B.HemisphericLight('ambient', V(0.1,1,0.2), scene);
ambient.intensity = 0.9;
const key = new B.DirectionalLight('softbox', V(-0.7,-1,0.6), scene);
key.intensity = 1.3;

function material(name, hex, specular = 0.12) {
  const m = new B.StandardMaterial(name, scene);
  m.diffuseColor = B.Color3.FromHexString(hex);
  m.specularColor = new B.Color3(specular,specular,specular);
  return m;
}
const wood = material('natural dark walnut', '#37291e', .13);
const trim = material('black rail trim', '#111e1d', .09);
const rubber = material('cushion', '#1b574e', .05);
const cloth = material('tournament cloth', '#17564c', .02);
const pocketMat = material('pocket leather', '#05080b', .02);
const floor = material('club floor', '#181d20', 0);
const cueMat = material('cue ash wood', '#d0ad79', .35);
const tipMat = material('blue cue tip', '#225a78', .12);

const ground = B.MeshBuilder.CreateGround('dark floor', { width: 24, height: 24 }, scene);
ground.position.y = -0.68;
ground.material = floor;
ground.isPickable = false;

const body = B.MeshBuilder.CreateBox('table base', {width:2.87, height:0.18, depth:1.59}, scene);
body.position.y = -0.09;
body.material = wood;
body.isPickable = false;
const shelf = B.MeshBuilder.CreateBox('black lining', {width:2.72,height:.025,depth:1.44},scene);
shelf.position.y = 0.008;
shelf.material = trim;
shelf.isPickable = false;
const felt = B.MeshBuilder.CreateBox('playfield', {width:SPEC.length,height:.013,depth:SPEC.width},scene);
felt.position.y = .023;
felt.material = cloth;
felt.metadata = { aimSurface: true };

// Segmented rail meshes leave visual openings for the six pockets.
// These meshes are decoration; physics rails are provisional straight planes.
function rail(name, width, depth, x, z) {
  const mesh = B.MeshBuilder.CreateBox(name,{width,height:.058,depth},scene);
  mesh.position.set(x,.055,z);
  mesh.material = rubber;
  mesh.isPickable = false;
}
for (const z of [-SPEC.width/2-.034,SPEC.width/2+.034]) {
  rail('long rail',1.13,.055,-.64,z);
  rail('long rail',1.13,.055, .64,z);
}
for (const x of [-SPEC.length/2-.034,SPEC.length/2+.034]) {
  rail('short rail',.055,1.13,x,0);
}
for (const p of POCKETS) {
  const mesh = B.MeshBuilder.CreateCylinder('pocket', {
    diameter: p.r * 2, height:.015, tessellation:32
  },scene);
  mesh.position.set(p.x,.035,p.z);
  mesh.material = pocketMat;
  mesh.isPickable = false;
}

// Wooden pedestal suggests an actual club table rather than an arcade mat.
const legMat = material('steel base', '#282b2d',.35);
for (const x of [-.86,.86]) {
  const leg = B.MeshBuilder.CreateBox('table leg',{width:.25,height:.46,depth:.38},scene);
  leg.position.set(x,-.4,0);
  leg.material = legMat;
  leg.isPickable = false;
}

function ballMaterial(id) {
  const base = colors[id];
  const texture = new B.DynamicTexture('ball number ' + id,{width:512,height:256},scene,false);
  const ctx = texture.getContext();
  ctx.fillStyle = id > 8 ? '#f6f6ed' : base;
  ctx.fillRect(0,0,512,256);
  if(id>8) {
    ctx.fillStyle = base;
    ctx.fillRect(0,62,512,132);
  }
  if(id!==0) {
    for (const x of [128,384]) {
      ctx.beginPath(); ctx.arc(x,128,29,0,Math.PI*2);
      ctx.fillStyle = '#faf9ee';ctx.fill();
      ctx.fillStyle = '#15191b';ctx.font='bold 33px Arial';
      ctx.textAlign = 'center';ctx.textBaseline='middle';
      ctx.fillText(String(id),x,130);
    }
  }
  texture.update();
  const m = new B.StandardMaterial('ball mat ' + id,scene);
  m.diffuseTexture = texture;
  m.specularColor = new B.Color3(.65,.65,.65);
  m.specularPower = 95;
  return m;
}
const ballMeshes = new Map();
for(let id=0; id<=15; id++){
  const mesh = B.MeshBuilder.CreateSphere('ball '+id,{diameter:SPEC.ballR*2,segments:24},scene);
  mesh.material = ballMaterial(id);
  mesh.isPickable = false;
  ballMeshes.set(id,mesh);
}

let cue = B.MeshBuilder.CreateTube('cue',{path:[V(-1,0,-1),V(-2,0,-1)],radius:.008,tessellation:10,updatable:true},scene);
cue.material = cueMat;
cue.isPickable = false;
let aim = B.MeshBuilder.CreateLines('aim',{points:[V(0,.07,0),V(.8,.07,0)],updatable:true},scene);
aim.color = new B.Color3(1,.83,.45);
aim.isPickable = false;

// A generous but nearly invisible hit area along the SHAFT, not ahead of the cue ball.
// The target follows the same geometry as the visible cue so touch can grab it too.
const cueHandle = B.MeshBuilder.CreateBox('cue shaft grab area', {
  width: 1.20, height: .085, depth: .095
}, scene);
const gripMaterial = new B.StandardMaterial('transparent grip target', scene);
gripMaterial.diffuseColor = B.Color3.FromHexString('#d4aa62');
gripMaterial.alpha = 0.005;
gripMaterial.disableLighting = true;
gripMaterial.disableDepthWrite = true;
cueHandle.material = gripMaterial;
cueHandle.isPickable = true;
cueHandle.renderingGroupId = 2;

function cueBall(){return state.balls.find(b=>b.id===0 && b.active);}
function positionCamera() {
  if (state.top) {
    camera.alpha = -Math.PI / 2;
    camera.beta = .08;
    camera.radius = 3.12;
    camera.setTarget(V(0, 0, 0));
    return;
  }
  const b = cueBall();
  const dx = Math.cos(state.angle), dz = Math.sin(state.angle);
  camera.alpha = Math.atan2(-dz, -dx);
  camera.beta = 1.15;
  camera.radius = 2.08;
  camera.setTarget(V((b?.x ?? 0) + dx * .32, 0, (b?.z ?? 0) + dz * .32));
}
function guide() {
  // Keep the perspective fixed during a drag to prevent pointer-angle feedback.
  if (!state.drag) positionCamera();
  const b = cueBall();
  const ready = !!b && !moving(state.balls);
  cue.setEnabled(ready);
  cueHandle.setEnabled(ready);
  aim.setEnabled(ready);
  if (!ready) return;
  const dx = Math.cos(state.angle), dz = Math.sin(state.angle);
  const h = SPEC.ballR + .04;
  const end = V(b.x - dx*(1.30+state.pull),h,b.z - dz*(1.30+state.pull));
  const start = V(b.x - dx*(.075+state.pull),h,b.z - dz*(.075+state.pull));
  cue = B.MeshBuilder.CreateTube('cue',{path:[end,start],radius:.008,tessellation:10,instance:cue},scene);
  cueHandle.position.set(b.x - dx * (.69+state.pull), h, b.z - dz * (.69+state.pull));
  cueHandle.rotation.y = -state.angle;
  aim = B.MeshBuilder.CreateLines('aim',{points:[V(b.x+dx*.05,h,b.z+dz*.05),V(b.x+dx*.86,h,b.z+dz*.86)],instance:aim},scene);
  cue.setEnabled(true);
  aim.setEnabled(true);
}

function placeBalls() {
  for (const mesh of ballMeshes.values()) mesh.setEnabled(false);
  for (const b of state.balls) {
    const mesh = ballMeshes.get(b.id);
    if(!mesh) continue;
    mesh.setEnabled(b.active);
    mesh.position.set(b.x, SPEC.ballR + .031, b.z);
  }
}

function status() {
  const busy = moving(state.balls);
  if(busy) $('status').textContent = 'Gule sú v pohybe';
  else if(!cueBall()) $('status').textContent = 'Biela potopená · nový rozstrel';
  else $('status').textContent = 'Pripravený na úder';
  if(busy !== state.wasMoving) {
    state.wasMoving = busy;
    guide();
  }
}

function updatePower() {
  const percent = Math.round(Math.min(1, state.pull / .34) * 100);
  $('pullFill').style.width = percent + '%';
  $('pullPower').textContent = percent + ' %';
}
function shoot(percent) {
  if (moving(state.balls) || !cueBall()) return;
  state.pull = 0;
  updatePower();
  if(strike(state.balls,state.angle,percent,state.contact)){
    $('status').textContent = 'Úder vykonaný';
    guide();
  }
}
function showContact() {
  const { x, y } = state.contact;
  $('spinDot').style.left = (50 + x * 39) + '%';
  $('spinDot').style.top = (50 - y * 39) + '%';
  let label = Math.abs(x) < .15 && Math.abs(y) < .15 ? 'STRED'
    : Math.abs(y) >= Math.abs(x) ? (y > 0 ? 'DOHRÁVKA' : 'SŤAHOVÁK')
    : (x > 0 ? 'PRAVÝ FALŠ' : 'ĽAVÝ FALŠ');
  $('spinName').textContent = label;
}
function reset() {
  state.balls = createRack((Math.random()*0xffffffff) >>> 0);
  state.angle = 0;
  state.accumulator = 0;
  state.wasMoving = false;
  state.drag = null;
  state.pull = 0;
  updatePower();
  placeBalls(); guide(); status();
}
function cameraMode() {
  state.top = !state.top;
  positionCamera();
  $('camera').textContent = state.top ? '3D POHĽAD' : 'POHĽAD ZHORA';
  $('viewLabel').textContent = state.top ? 'Z HORA' : 'OD TÁGA';
}

// Babylon scene.pick expects canvas-local CSS coordinates, not device pixels.
function canvasCoords(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function cuePointer(event) {
  const {x, y} = canvasCoords(event);
  const ray = scene.createPickingRay(x, y, B.Matrix.Identity(), camera);
  const h = SPEC.ballR + .04;
  if (!ray || Math.abs(ray.direction.y) < 1e-6) return null;
  const t = (h - ray.origin.y) / ray.direction.y;
  if (t <= 0) return null;
  return ray.origin.add(ray.direction.scale(t));
}

function pointerAngle(event) {
  const p = cuePointer(event), b = cueBall();
  if (!p || !b) return null;
  const dx = b.x - p.x, dz = b.z - p.z;
  if (Math.hypot(dx, dz) < .08) return null;
  return Math.atan2(dz, dx);
}

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

canvas.addEventListener('pointerdown', event => {
  if (state.drag || moving(state.balls) || !cueBall()) return;
  const {x, y} = canvasCoords(event);
  const hit = scene.pick(x, y, mesh => mesh === cueHandle);
  if (!hit?.hit || hit.pickedMesh !== cueHandle) return;
  const startPointerAngle = pointerAngle(event);
  if (startPointerAngle === null) return;
  const grab = cuePointer(event);
  if (!grab) return;
  state.drag = {
    id: event.pointerId,
    aimAtStart: state.angle,
    pointerAtStart: startPointerAngle,
    start: grab
  };
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = 'grabbing';
  event.preventDefault();
});

canvas.addEventListener('pointermove', event => {
  if (state.drag && state.drag.id === event.pointerId) {
    const a = pointerAngle(event);
    if (a === null) return;
    state.angle = wrapAngle(state.drag.aimAtStart +
      wrapAngle(a - state.drag.pointerAtStart));
    const p = cuePointer(event);
    if (p) {
      const dx = Math.cos(state.drag.aimAtStart);
      const dz = Math.sin(state.drag.aimAtStart);
      const back = -((p.x-state.drag.start.x)*dx + (p.z-state.drag.start.z)*dz);
      state.pull = Math.max(0, Math.min(.34, back));
      updatePower();
    }
    guide();
    event.preventDefault();
    return;
  }
  if (moving(state.balls) || !cueBall()) {
    canvas.style.cursor = 'default';
    return;
  }
  const {x, y} = canvasCoords(event);
  const hit = scene.pick(x, y, mesh => mesh === cueHandle);
  canvas.style.cursor = hit?.hit ? 'grab' : 'default';
});

function finishCueDrag(event, canceled = false) {
  if (!state.drag || state.drag.id !== event.pointerId) return;
  // Capture the final pointer position to avoid losing the last input frame.
  const lastPoint = cuePointer(event);
  if (lastPoint && !canceled) {
    const dx = Math.cos(state.drag.aimAtStart), dz = Math.sin(state.drag.aimAtStart);
    const back = -((lastPoint.x-state.drag.start.x)*dx + (lastPoint.z-state.drag.start.z)*dz);
    state.pull = Math.max(0,Math.min(.34,back));
    const angle = pointerAngle(event);
    if (angle !== null) state.angle = wrapAngle(state.drag.aimAtStart +
      wrapAngle(angle-state.drag.pointerAtStart));
  }
  const percent = Math.min(100,Math.round(state.pull/.34*100));
  state.drag = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  canvas.style.cursor = 'default';
  state.pull = 0;
  updatePower();
  if (!canceled && percent >= 8) shoot(percent);
  else guide();
}

canvas.addEventListener('pointerup', event => finishCueDrag(event));
canvas.addEventListener('pointercancel', event => finishCueDrag(event,true));
canvas.addEventListener('lostpointercapture', event => {
  if (!state.drag || state.drag.id !== event.pointerId) return;
  state.drag = null;
  state.pull = 0;
  updatePower();
  canvas.style.cursor = 'default';
  guide();
});
const spinPad = $('spinPad');
function pickSpin(event) {
  const rect = spinPad.getBoundingClientRect();
  let x = (event.clientX - (rect.left + rect.width/2)) / (rect.width/2 - 5);
  let y = - (event.clientY - (rect.top + rect.height/2)) / (rect.height/2 - 5);
  const radius = Math.hypot(x,y);
  if (radius > .85) { x *= .85/radius; y *= .85/radius; }
  state.contact = {x, y};
  showContact();
}
let spinPointerId = null;
spinPad.addEventListener('pointerdown',event=>{
  spinPointerId = event.pointerId;
  spinPad.setPointerCapture(event.pointerId);
  pickSpin(event);
  event.preventDefault();
});
spinPad.addEventListener('pointermove',event=>{
  if (spinPointerId !== event.pointerId) return;
  pickSpin(event);
  event.preventDefault();
});
function endSpin(event){if(spinPointerId===event.pointerId)spinPointerId=null;}
spinPad.addEventListener('pointerup',endSpin);
spinPad.addEventListener('pointercancel',endSpin);
$('spinReset').addEventListener('click',()=>{state.contact={x:0,y:0};showContact();});
$('camera').addEventListener('click',cameraMode);
$('rack').addEventListener('click',reset);
$('fullscreen').addEventListener('click',()=>{
  if(document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(()=>{});
});
window.addEventListener('keydown',e=>{
  if(e.code==='Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)){
    e.preventDefault(); shoot(50);
  }
  if((e.code==='ArrowLeft'||e.code==='ArrowRight') && !(e.target instanceof HTMLInputElement)){
    e.preventDefault();
    state.angle += (e.code==='ArrowLeft' ? -1 : 1)*Math.PI/720;
    guide();
  }
});
window.addEventListener('resize',()=>engine.resize());
scene.onBeforeRenderObservable.add(()=>{
  state.accumulator += Math.min(engine.getDeltaTime()/1000,.075);
  let steps=0;
  while(state.accumulator >= SPEC.fixedDt && steps < 20){
    step(state.balls);
    state.accumulator-=SPEC.fixedDt;
    steps++;
  }
  // Drop excess time instead of letting a background tab spiral.
  if(steps===20) state.accumulator=0;
  placeBalls();
  status();
});
placeBalls();showContact();updatePower();guide();status();
engine.runRenderLoop(()=>scene.render());
