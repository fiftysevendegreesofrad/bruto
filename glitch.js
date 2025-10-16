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
// make base white so mix-blend: multiply doesn't darken the whole page
const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const glitchPass = new GlitchPass();
glitchPass.goWild = true;
// start disabled; we'll enable periodically
glitchPass.enabled = false;
composer.addPass(glitchPass);

const maxSpeed = 10;

const scanlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    speed: { value: maxSpeed/2 },
    // much smaller intensity for subtle effect
    scanlineIntensity: { value: 0.1 },
    scanlineCount: { value: 400.0 }
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
      vec4 color = texture2D(tDiffuse, vUv); // base is white
      // sine in [0..1]
      float s = 0.5 * (sin(vUv.y * scanlineCount + time * speed) + 1.0);
      // only darken at the peaks to make very thin lines
      float mask = s;//smoothstep(0.985, 1.0, s);
      float mul = 1.0 - scanlineIntensity * mask;
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
const SCANLINE_CHANGE_INTERVAL = 1; // seconds
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
  if (now - lastScanlineChangeTime >= SCANLINE_CHANGE_INTERVAL) {
    lastScanlineChangeTime = now;
    scanlinePass.uniforms.speed.value = Math.random() * maxSpeed - maxSpeed/2;
  }

  // scanlines update every frame (always on)
  scanlinePass.uniforms.time.value += 0.01;

  composer.render();
}
animate();
