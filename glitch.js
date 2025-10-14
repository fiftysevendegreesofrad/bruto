import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';


const container = document.getElementById('glitch-overlay');
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const glitchPass = new GlitchPass();
glitchPass.goWild = true;
// start disabled; we'll enable periodically
glitchPass.enabled = false;
composer.addPass(glitchPass);

const scanlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    speed: { value: 5.0 },
    scanlineIntensity: { value: 0.1 },
    scanlineCount: { value: 800.0 }
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
    uniform float time;
    uniform float speed;
    uniform float scanlineIntensity;
    uniform float scanlineCount;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float scanline = sin(vUv.y * scanlineCount + time * speed);
      color.rgb -= scanline * scanlineIntensity;
      gl_FragColor = color;
    }
  `
};
const scanlinePass = new ShaderPass(scanlineShader);
composer.addPass(scanlinePass);

const chromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.003 }
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
    varying vec2 vUv;

    void main() {
      vec4 r = texture2D(tDiffuse, vUv + vec2(offset, 0.0));
      vec4 g = texture2D(tDiffuse, vUv);
      vec4 b = texture2D(tDiffuse, vUv - vec2(offset, 0.0));
      gl_FragColor = vec4(r.r, g.g, b.b, 1.0);
    }
  `
};
const chromaticPass = new ShaderPass(chromaticShader);
composer.addPass(chromaticPass);

// schedule glitch once per minute, short burst
const GLITCH_INTERVAL = 60.0; // seconds
const GLITCH_DURATION = 0.5;  // seconds
let lastGlitchTime = 0;
let lastScanlineChangeTime = 0;
let started = false;

function animate(time) {
  requestAnimationFrame(animate);

  // convert RAF timestamp (ms) -> seconds
  const now = (time || performance.now()) / 1000;

  // initialize baseline on first frame
  if (!started) {
    lastGlitchTime = now;
    lastScanlineChangeTime = now;
    started = true;
  }

  // start a burst when interval elapsed
  if (now - lastGlitchTime >= GLITCH_INTERVAL) {
    lastGlitchTime = now;
  }

  // enable glitch only during the short burst window
  glitchPass.enabled = (now - lastGlitchTime) < GLITCH_DURATION;

  // change scanline speed every so often
  if (now - lastScanlineChangeTime >= 15.0) {
    lastScanlineChangeTime = now;
    scanlinePass.uniforms.speed.value = Math.random() * 10.0 - 5.0;
  }

  // scanlines update every frame (always on)
  scanlinePass.uniforms.time.value += 0.01;

  composer.render();
}
animate();
