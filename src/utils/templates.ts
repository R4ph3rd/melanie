import type { ExampleSketch } from './types'

export const DEFAULT_P5_CODE = `
let bgBrightness = 255;

function setup() {
  createCanvas(460, 400);
}

function draw() {
  background(bgBrightness);
}`

export const DEFAULT_THREEJS_CODE = `
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 460 / 400, 0.1, 100);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(460, 400);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);


function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
}`

export const CONCENTRIC_CIRCLES = `
let numCircles = 8;
let circleSize = 48;
let strokeW = 2;
let bgBrightness = 255;

function setup() {
  createCanvas(460, 400);
}

function draw() {
  background(bgBrightness);
  let cx = width / 2;
  let cy = height / 2;
  stroke(0);
  strokeWeight(strokeW);
  noFill();
  for (let i = 1; i <= numCircles; i++) {
    circle(cx, cy, circleSize * i);
  }
}`

export const TORUS = `
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 460 / 400, 0.1, 100);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(460, 400);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.TorusGeometry(1, 0.3, 16, 64);
const material = new THREE.MeshNormalMaterial({ wireframe: false });
const torus = new THREE.Mesh(geometry, material);
scene.add(torus);

function animate() {
  requestAnimationFrame(animate);
  torus.rotation.x += 0.01;
  torus.rotation.y += 0.015;
  renderer.render(scene, camera);
}
animate();`

export const EXAMPLE_SKETCHES: ExampleSketch[] = [
  {
    id: 'circles',
    title: 'Concentric Circles',
    description: 'Simple concentric circles',
    library: 'p5js',
    code: CONCENTRIC_CIRCLES,
  },
  {
    id: 'bouncing',
    title: 'Bouncing Balls',
    description: 'Balls bouncing off walls',
    library: 'p5js',
    code: `let numBalls = 12;
let ballSize = 20;
let speed = 2;
let balls = [];

function setup() {
  createCanvas(460, 400);
  for (let i = 0; i < numBalls; i++) {
    balls.push({
      x: random(ballSize, width - ballSize),
      y: random(ballSize, height - ballSize),
      vx: random(-speed, speed) || speed,
      vy: random(-speed, speed) || speed,
      c: color(random(100,255), random(100,255), random(100,255)),
    });
  }
}

function draw() {
  background(20);
  for (let b of balls) {
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < ballSize || b.x > width - ballSize)  b.vx *= -1;
    if (b.y < ballSize || b.y > height - ballSize) b.vy *= -1;
    fill(b.c);
    noStroke();
    circle(b.x, b.y, ballSize * 2);
  }
}`,
  },
  {
    id: 'spiral',
    title: 'Spiral',
    description: 'Animated spiral pattern',
    library: 'p5js',
    code: `let numPoints = 300;
let radiusScale = 1.5;
let angleStep = 0.2;
let t = 0;

function setup() {
  createCanvas(460, 400);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(0, 0, 10, 15);
  translate(width / 2, height / 2);
  noFill();
  for (let i = 0; i < numPoints; i++) {
    let angle = i * angleStep + t;
    let r = i * radiusScale;
    let x = cos(angle) * r;
    let y = sin(angle) * r;
    let hue = (i * 1.2 + t * 50) % 360;
    stroke(hue, 80, 100, 80);
    strokeWeight(2);
    point(x, y);
  }
  t += 0.02;
}`,
  },
  {
    id: 'perlin',
    title: 'Perlin Flow Field',
    description: 'Flow field using Perlin noise',
    library: 'p5js',
    code: `let scl = 20;
let cols, rows;
let zoff = 0;
let particles = [];
let numParticles = 200;

function setup() {
  createCanvas(460, 400);
  cols = floor(width / scl);
  rows = floor(height / scl);
  for (let i = 0; i < numParticles; i++) {
    particles.push(createVector(random(width), random(height)));
  }
  background(10);
}

function draw() {
  fill(10, 10, 10, 5);
  noStroke();
  rect(0, 0, width, height);
  let yoff = 0;
  for (let y = 0; y < rows; y++) {
    let xoff = 0;
    for (let x = 0; x < cols; x++) {
      let angle = noise(xoff, yoff, zoff) * TWO_PI * 2;
      xoff += 0.1;
    }
    yoff += 0.1;
  }
  stroke(180, 130, 255, 120);
  strokeWeight(1.2);
  for (let p of particles) {
    let x = floor(p.x / scl);
    let y = floor(p.y / scl);
    let angle = noise(x * 0.1, y * 0.1, zoff) * TWO_PI * 2;
    let vel = p5.Vector.fromAngle(angle);
    vel.setMag(1.5);
    p.add(vel);
    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
      p.x = random(width);
      p.y = random(height);
    }
    point(p.x, p.y);
  }
  zoff += 0.005;
}`,
  },
  {
    id: 'lissajous',
    title: 'Lissajous Curve',
    description: 'Animated Lissajous figure',
    library: 'p5js',
    code: `let a = 3;
let b = 2;
let delta = 0;
let trailLength = 400;
let radius = 160;
let trail = [];

function setup() {
  createCanvas(460, 400);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(0, 0, 8, 30);
  translate(width / 2, height / 2);
  trail.push(createVector(
    radius * sin(a * delta + HALF_PI),
    radius * sin(b * delta)
  ));
  if (trail.length > trailLength) trail.shift();
  noFill();
  beginShape();
  for (let i = 0; i < trail.length; i++) {
    let hue = map(i, 0, trail.length, 200, 320);
    let alpha = map(i, 0, trail.length, 20, 90);
    stroke(hue, 80, 100, alpha);
    strokeWeight(map(i, 0, trail.length, 0.5, 2.5));
    vertex(trail[i].x, trail[i].y);
  }
  endShape();
  delta += 0.02;
}`,
  },
  {
    id: 'grid',
    title: 'Interactive Grid',
    description: 'Grid reacts to mouse',
    library: 'p5js',
    code: `let gridSize = 30;
let cols, rows;
let influence = 120;
let dotSize = 4;

function setup() {
  createCanvas(460, 400);
  cols = floor(width / gridSize);
  rows = floor(height / gridSize);
}

function draw() {
  background(12);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = i * gridSize + gridSize / 2;
      let y = j * gridSize + gridSize / 2;
      let d = dist(mouseX, mouseY, x, y);
      let s = map(d, 0, influence, dotSize * 3, dotSize, true);
      let bright = map(d, 0, influence, 255, 80, true);
      fill(bright * 0.6, bright * 0.4, bright);
      noStroke();
      circle(x, y, s);
    }
  }
}`,
  },
  {
    id: 'torus3d',
    title: '3D Torus',
    description: 'Rotating torus with normals',
    library: 'threejs',
    code: TORUS,
  },
  {
    id: 'particles3d',
    title: '3D Particles',
    description: 'Floating particle system',
    library: 'threejs',
    code: `const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 460 / 400, 0.1, 200);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(460, 400);
renderer.setClearColor(0x050510);
document.body.appendChild(renderer.domElement);

const numParticles = 1500;
const positions = new Float32Array(numParticles * 3);
const velocities = [];

for (let i = 0; i < numParticles; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 10;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  velocities.push(
    (Math.random() - 0.5) * 0.01,
    (Math.random() - 0.5) * 0.01,
    (Math.random() - 0.5) * 0.01
  );
}

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const mat = new THREE.PointsMaterial({ color: 0x8855ff, size: 0.05 });
const pts = new THREE.Points(geo, mat);
scene.add(pts);

function animate() {
  requestAnimationFrame(animate);
  const pos = geo.attributes.position.array;
  for (let i = 0; i < numParticles; i++) {
    pos[i*3]     += velocities[i*3];
    pos[i*3+1]   += velocities[i*3+1];
    pos[i*3+2]   += velocities[i*3+2];
    if (Math.abs(pos[i*3])   > 5) velocities[i*3]   *= -1;
    if (Math.abs(pos[i*3+1]) > 5) velocities[i*3+1] *= -1;
    if (Math.abs(pos[i*3+2]) > 5) velocities[i*3+2] *= -1;
  }
  geo.attributes.position.needsUpdate = true;
  pts.rotation.y += 0.003;
  renderer.render(scene, camera);
}
animate();`,
  },
]
