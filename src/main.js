
import { SPEC, POCKETS, createRack, strike, step, moving } from './physics.mjs';

const B = window.BABYLON;
const $ = id => document.getElementById(id);
const canvas = $('game');
const state = { balls: createRack(8), angle: 0, power: 65, top: true, accumulator: 0, wasMoving: false };
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
const camera = new B.ArcRotateCamera('camera', -Math.PI/2, 0.08, 3.65, V(0,0,0), scene);
camera.lowerRadiusLimit = 2;
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
    diameter: p.r*2.22, height:.015, tessellation:32
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

function cueBall(){return state.balls.find(b=>b.id===0 && b.active);}
function guide() {
  const b = cueBall();
  const ready = !!b && !moving(state.balls);
  cue.setEnabled(ready);
  aim.setEnabled(ready);
  if (!ready) return;
  const dx = Math.cos(state.angle), dz = Math.sin(state.angle);
  const h = SPEC.ballR + .04;
  const end = V(b.x - dx*1.30,h,b.z - dz*1.30);
  const start = V(b.x - dx*.075,h,b.z - dz*.075);
  cue = B.MeshBuilder.CreateTube('cue',{path:[end,start],radius:.008,tessellation:10,instance:cue},scene);
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
  $('shoot').disabled = busy || !cueBall();
  if(busy) $('status').textContent = 'Gule sú v pohybe';
  else if(!cueBall()) $('status').textContent = 'Biela potopená · nový rozstrel';
  else $('status').textContent = 'Pripravený na úder';
  if(busy !== state.wasMoving) {
    state.wasMoving = busy;
    guide();
  }
}

function shoot() {
  if(strike(state.balls,state.angle,state.power)){
    $('status').textContent = 'Úder vykonaný';
    guide();
  }
}
function reset() {
  state.balls = createRack((Math.random()*0xffffffff) >>> 0);
  state.angle = 0;
  state.accumulator = 0;
  state.wasMoving = false;
  placeBalls(); guide(); status();
}
function cameraMode() {
  state.top = !state.top;
  camera.alpha = -Math.PI/2;
  camera.beta = state.top ? .08 : .95;
  camera.radius = state.top ? 3.65 : 3.85;
  $('camera').textContent = state.top ? '3D POHĽAD' : 'POHĽAD ZHORA';
  $('viewLabel').textContent = state.top ? 'Z HORA' : 'OD STOLA';
}

canvas.addEventListener('pointerdown', () => {
  if(moving(state.balls) || !cueBall()) return;
  const hit = scene.pick(scene.pointerX,scene.pointerY,m=>m === felt);
  if(!hit?.hit || !hit.pickedPoint) return;
  const p = hit.pickedPoint;
  const cueBallNow = cueBall();
  const dx=p.x-cueBallNow.x, dz=p.z-cueBallNow.z;
  if(Math.hypot(dx,dz)<.04) return;
  state.angle = Math.atan2(dz,dx);
  guide();
});
$('minus').addEventListener('click',()=>{state.angle-=Math.PI/720;guide();});
$('plus').addEventListener('click',()=>{state.angle+=Math.PI/720;guide();});
$('camera').addEventListener('click',cameraMode);
$('rack').addEventListener('click',reset);
$('shoot').addEventListener('click',shoot);
$('power').addEventListener('input',e=>{
  state.power=Number(e.currentTarget.value);
  $('powerNumber').textContent=state.power;
});
$('fullscreen').addEventListener('click',()=>{
  if(document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(()=>{});
});
window.addEventListener('keydown',e=>{
  if(e.code==='Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)){
    e.preventDefault(); shoot();
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
placeBalls();guide();status();
engine.runRenderLoop(()=>scene.render());
