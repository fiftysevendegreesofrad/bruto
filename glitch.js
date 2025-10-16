import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';

// Use full-viewport canvas and layer it above, but attach to #glitch-overlay for CSS blending
const overlay = document.getElementById('glitch-overlay');
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
// ensure canvas clears to transparent
renderer.setClearColor(0x000000, 0);

// append to overlay (not body) so multiply blending from CSS applies
// document.body.appendChild(renderer.domElement);
overlay.appendChild(renderer.domElement);

// keep canvas over everything, non-interactive, and blended
renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:9999;mix-blend-mode:multiply;';

// create composer before any size ops
const composer = new EffectComposer(renderer);

// window-based sizing
function resizeToWindow() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
}
resizeToWindow();
window.addEventListener('resize', resizeToWindow);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const geometry = new THREE.PlaneGeometry(2, 2);
// make base white so mix-blend: multiply doesn't darken the whole page
const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

composer.addPass(new RenderPass(scene, camera));

const glitchPass = new GlitchPass();
glitchPass.goWild = true;
// start disabled; we'll enable periodically
glitchPass.enabled = false;
composer.addPass(glitchPass);

const maxSpeed = 10;
const MIN_SCANLINE_INTENSITY = 0.04; // minimum visible scanline intensity

const scanlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    // replaced time with an accumulated phase to avoid jumps when speed changes
    phase: { value: 0 },
    speed: { value: maxSpeed/2 },
    scanlineIntensity: { value: 0.1 },
    scanlineCount: { value: 300.0 },
    // NEW: phase for the 20s intensity modulation
    intensityPhase: { value: 0 },
    _dynIntensity: { value: 0.1 } // new uniform for clamped dynamic intensity
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float phase;
    uniform float scanlineIntensity;
    uniform float scanlineCount;
    uniform float intensityPhase;
    uniform float _dynIntensity;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Quantize to scanline row
      float scanline = floor(vUv.y * scanlineCount);
      float rowY = scanline / scanlineCount;
      float s = 0.5 * (sin(rowY * scanlineCount + phase) + 1.0);

      // Use the clamped dynamic intensity from JS
      float dynIntensity = _dynIntensity;

      float mul = 1.0 - dynIntensity * s;
      color.rgb *= mul;
      gl_FragColor = color;
    }
  `
};
const scanlinePass = new ShaderPass(scanlineShader);
composer.addPass(scanlinePass);

const chromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.003 },
    // NEW: boost and phase for stronger glitch
    glitchBoost: { value: 0.0 },
    boostPhase: { value: 0.0 },
    lineScale: { value: 720.0 }, // number of rows for jitter
    // NEW: maximum darkening applied during glitch so it’s visible under multiply
    darkenMax: { value: 0.6 },
    // NEW: overall glitch intensity (master control)
    glitchIntensity: { value: 1.0 },
    // NEW: controls vertical scroll of glitch bands (0..1)
    glidePhase: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float glitchBoost;  // 0..1
    uniform float boostPhase;
    uniform float lineScale;
    uniform float darkenMax;
    uniform float glitchIntensity;
    uniform float glidePhase;   // NEW
    varying vec2 vUv;

    // hash for per-row randomness
    float hash(float x) {
      return fract(sin(x) * 43758.5453123);
    }

    void main() {
      // per-row horizontal jitter
      // Use glidePhase to scroll which rows are affected; changes direction from JS
      float row = floor(fract(vUv.y + glidePhase) * lineScale);
      float rnd = hash(row + floor(boostPhase * 17.0)) - 0.5;

      // scale all glitch components by master intensity
      float g = clamp(glitchBoost * glitchIntensity, 0.0, 4.0); // allows >1 for extra strong

      vec2 jitter = vec2(rnd, 0.0) * (0.02 * g); // jitter scales with g
      float dyn = offset * mix(1.0, 6.0, clamp(g, 0.0, 1.0)); // channel sep scales with g (clamped for balance)

      vec4 r = texture2D(tDiffuse, vUv + jitter + vec2(dyn, 0.0));
      vec4 gch = texture2D(tDiffuse, vUv + jitter * 0.5);
      vec4 b = texture2D(tDiffuse, vUv + jitter - vec2(dyn, 0.0));

      // independent glitch darkening
      float band = smoothstep(0.25, 0.5, abs(rnd));
      float dark = darkenMax * clamp(g, 0.0, 1.5) * band;

      vec3 col = vec3(r.r, gch.g, b.b) * (1.0 - dark);
      gl_FragColor = vec4(col, 1.0);
    }
  `
};
const chromaticPass = new ShaderPass(chromaticShader);
composer.addPass(chromaticPass);

// Set overall glitch intensity here (increase > 1.0 for stronger; < 1.0 for softer)
chromaticPass.uniforms.glitchIntensity.value = 0.5;

// REMOVE: schedule glitch once per minute, short burst
// const GLITCH_INTERVAL = 2.0; // seconds
const GLITCH_DURATION = 0.05;  // seconds
const LONG_GLITCH_DURATION = 1.0; // seconds (NEW)
const SCANLINE_CHANGE_INTERVAL = 5; // seconds
const INTENSITY_PERIOD = 20.0; // seconds (NEW)
// REMOVE: let lastGlitchTime = 0;
let lastScanlineChangeTime = 0;
let started = false;
let prevNow = 0;
// NEW: smooth glitch strength
let glitchBoost = 0.0;
// NEW: track direction (+1/-1) and current glide phase [0..1]
let prevGlitchEnabled = false;
let glitchDir = 1.0;
let glide = 0.0;
// NEW: pointer-driven glitch deadline
let glitchEndTime = 0;
// NEW: long glitch deadline
let longGlitchUntil = 0;

// NEW: trigger glitch on any mouse/touch press (do not block the event)
// Ignore while a long glitch is active
function triggerGlitch() {
  const now = performance.now() / 1000;
  if (now < longGlitchUntil) return; // ignore short trigger during long glitch
  glitchEndTime = now + GLITCH_DURATION;
}
window.addEventListener('pointerdown', triggerGlitch, { passive: true });

// NEW: expose a window API to trigger a longer glitch (default 1s). While active,
// pointer-triggered glitches are ignored.
window.triggerLongGlitch = function(duration = LONG_GLITCH_DURATION) {
  const now = performance.now() / 1000;
  const len = Math.max(0.001, duration);
  longGlitchUntil = now + len;
  glitchEndTime = Math.max(glitchEndTime, longGlitchUntil);
};

function animate(time) {
  requestAnimationFrame(animate);

  // convert RAF timestamp (ms) -> seconds
  const now = (time || performance.now()) / 1000;

  // initialize baseline on first frame
  if (!started) {
    // lastGlitchTime = now; // <-- removed
    lastScanlineChangeTime = now;
    prevNow = now; // init for stable dt
    started = true;
  }

  const dt = now - prevNow;

  // enable glitch during the active deadline window
  const glitchEnabled = now < glitchEndTime;
  glitchPass.enabled = glitchEnabled;

  // on glitch rising edge, choose a random direction
  if (glitchEnabled && !prevGlitchEnabled) {
    glitchDir = Math.random() < 0.5 ? 1.0 : -1.0;
  }

  // change scanline speed every so often
  if (now - lastScanlineChangeTime >= SCANLINE_CHANGE_INTERVAL) {
    lastScanlineChangeTime = now;
    scanlinePass.uniforms.speed.value = Math.random() * maxSpeed - maxSpeed/2;
  }

  // integrate intensity phase for a 20s period (always)
  scanlinePass.uniforms.intensityPhase.value += dt * (Math.PI * 2.0 / INTENSITY_PERIOD);

  // --- Scanline intensity threshold logic ---
  const intensityPhase = scanlinePass.uniforms.intensityPhase.value;
  let intensityWave = 0.5 + 0.5 * Math.sin(intensityPhase);
  let dynIntensity = scanlinePass.uniforms.scanlineIntensity.value * intensityWave;

  // Only advance scanline phase if not clamped
  if (dynIntensity >= MIN_SCANLINE_INTENSITY) {
    scanlinePass.uniforms.phase.value += dt * scanlinePass.uniforms.speed.value;
  }

  // Clamp dynIntensity if below threshold
  if (dynIntensity < MIN_SCANLINE_INTENSITY) {
    dynIntensity = MIN_SCANLINE_INTENSITY;
  }

  scanlinePass.uniforms._dynIntensity = { value: dynIntensity };

  // ramp chromatic glitch boost
  {
    const target = glitchEnabled ? 1.0 : 0.0;
    const ease = Math.min(1.0, dt * 12.0); // ~80ms ease
    glitchBoost += (target - glitchBoost) * ease;
    chromaticPass.uniforms.glitchBoost.value = glitchBoost;
    chromaticPass.uniforms.boostPhase.value += dt * (30.0 + 90.0 * glitchBoost);
  }

  // NEW: integrate glide so bands ascend/descend depending on glitchDir
  glide += dt * 0.8 * glitchDir * glitchBoost; // 0.8 cycles/sec at full boost
  if (glide > 1.0) glide -= 1.0;
  if (glide < 0.0) glide += 1.0;
  chromaticPass.uniforms.glidePhase.value = glide;

  // restrict draw to header width (full height)
  applyHeaderScissor();

  composer.render();

  // update prev flags/time
  prevGlitchEnabled = glitchEnabled;
  prevNow = now;
}
animate();

// helper: restrict drawing to header width using scissor + viewport
function applyHeaderScissor() {
  const hdr = document.querySelector('.header');
  if (!hdr) {
    renderer.setScissorTest(false);
    return;
  }
  const dpr = renderer.getPixelRatio ? renderer.getPixelRatio() : (window.devicePixelRatio || 1);
  const canvasRect = renderer.domElement.getBoundingClientRect();
  const headerRect = hdr.getBoundingClientRect();

  // x spans header's left/width; y spans full canvas height
  const x = Math.floor((headerRect.left - canvasRect.left) * dpr);
  const y = 0;
  const w = Math.max(1, Math.floor(headerRect.width * dpr));
  const h = Math.max(1, Math.floor(canvasRect.height * dpr));

  renderer.setScissorTest(true);
  renderer.setViewport(x, y, w, h);
  renderer.setScissor(x, y, w, h);
}
