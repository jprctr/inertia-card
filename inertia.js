import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { DotScreenShader } from 'three/addons/shaders/DotScreenShader.js';

import { vertexShader, fragmentShader } from './shaders.js';

// Constants

const margin = 0.1;
const radius = 0.05; // border radius for images expressed as % of height
const speeds = {
  stopped: 0,
  default: -0.001,
  arrowLeft: -0.1,
  arrowRight: 0.1,
  wheelMod: 0.001,
  dragMod: 0.5,
  tolerance: 0.001, // smallest value we care about
};

export async function SetupScene(containerId, slides) {
  // Setup

  const container = document.getElementById(containerId);
  container.style.cursor = 'grab';

  const textureLoader = new THREE.TextureLoader();
  const raycaster = new THREE.Raycaster();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xffffff );
  
  const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
  camera.position.z = 1;

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(container.offsetWidth, container.offsetHeight);
  container.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const shaderPass = new ShaderPass(DotScreenShader);
  composer.addPass(shaderPass);

  // Construct Objects

  const meshes = await Promise.all(
    slides.map((slide) => (
      new Promise(resolve => (
        textureLoader.load(slide.image, (texture) => {
          const aspect = texture.image.width / texture.image.height;

          const geometry = new THREE.PlaneGeometry(aspect, 1, 1, 1);

          const uniforms = {
            map: { type: 't', value: texture },
            radius: { type: 'f', value: radius },
            aspect: { type: 'f', value: aspect },
          };
          const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.userData = {
            ...slide,
            aspect,
          };

          return resolve(mesh);
        })
      ))
    ))
  );

  let xOffset = 0;
  meshes.forEach(mesh => {
    const width = mesh.userData.aspect;
    mesh.userData.xOffset = xOffset + width / 2;
    xOffset += width + margin;
    scene.add(mesh);
  });

  // Render

  const fullWidth = meshes.map(c => (c.userData.aspect + margin)).reduce((a, v) => a + v, 0);
  const halfWidth = fullWidth * 0.5;
  const bigOffset = 100000 * fullWidth; // helps make it "infinite" in either direction

  let speed = speeds.stopped;
  let currentOffset = 0;
  function animate() {
    meshes.forEach(mesh => {
      mesh.position.x = ((mesh.userData.xOffset + currentOffset + bigOffset) % fullWidth) - halfWidth;
    });
    currentOffset += (speed || speeds.default); // default to very slow scroll if no input
    shaderPass.uniforms['scale'].value = speed * 10;
    composer.render();
  }

  renderer.setAnimationLoop(animate);

  // Event Handlers

  let slowHandle;
  function slow() { // use this instead of instantly setting to stopped for smoother feel
    clearTimeout(slowHandle);
    // quick and dirty easing
    speed = THREE.MathUtils.lerp(speed, speeds.stopped, 0.1);
    if (Math.abs(speed) > speeds.tolerance) {
      slowHandle = setTimeout(() => slow(), 100);
    } else {
      speed = speeds.stopped;
    }
  }

  const keySpeeds = {
    'ArrowLeft': speeds.arrowLeft,
    'ArrowRight': speeds.arrowRight,
  };
  const validKeys = Object.keys(keySpeeds);

  function onKeyDown(event) {
    const { key } = event;
    if (validKeys.includes(key)) {
      speed = keySpeeds[key] || speeds.stopped;
    }
  }
  window.addEventListener('keydown', onKeyDown);

  function onKeyUp(event) {
    const { key } = event;
    if (validKeys.includes(key)) {
      // speed = speeds.stopped;
      slow();
    }
  }
  window.addEventListener('keyup', onKeyUp);

  let wheelHandle;
  function onWheel(event) {
    clearTimeout(wheelHandle); // new event, don't cancel
    clearTimeout(slowHandle) // new event, don't slow
    const { deltaY } = event;
    if (deltaY) {
      speed = deltaY * speeds.wheelMod;
    }
    wheelHandle = setTimeout(() => { // slow speed 100ms after last wheel
      // speed = speeds.stopped; // insta stop, works ok feels a bit off
      slow();
    }, 100);
  }
  container.addEventListener('wheel', onWheel);

  // Pointers

  // handled in onPointerup if not dragging
  function onClick(event) {
    const { clientX, clientY } = event;
    const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = container;
    const pointer = new THREE.Vector2(
      ((clientX - offsetLeft) / offsetWidth) * 2 - 1,
      (((clientY - offsetTop) / offsetHeight) * 2 - 1) * -1,
    );
    raycaster.setFromCamera(pointer, camera);
    const [intersect] = raycaster.intersectObjects(scene.children, false);
    if (intersect) {
      const { object } = intersect;
      const { userData } = object;
      const { link } = userData;
      if (link) {
        window.open(link); // new tab is nicer for dev
        // window.open(link, '_self'); // maybe link directly in this tab later
      }
    }
  }

  let pointerdown = false;
  let dragging = false;
  let lastX = null;

  function resetDrag() {
    container.style.cursor = 'grab';
    pointerdown = false;
    dragging = false;
    lastX = null;
    slow();
  }
  window.addEventListener('blur', resetDrag);
  window.addEventListener('pointerout', resetDrag);

  function onPointerdown() {
    resetDrag();
    pointerdown = true;
  }
  container.addEventListener('pointerdown', onPointerdown);

  function onPointerup(event) {
    if (!dragging) {
      onClick(event);
    }
    resetDrag();
  }
  container.addEventListener('pointerup', onPointerup);

  function onPointermove(event) {
    if (pointerdown) {
      container.style.cursor = 'grabbing';
      dragging = true;
      const { screenX } = event;
      let delta = 0;
      if (lastX === null) {
        lastX = screenX;
      } else {
        delta = (screenX - lastX);
      }
      speed = (delta / container.offsetWidth) * speeds.dragMod;
    }
  }
  container.addEventListener('pointermove', onPointermove);

  // Resize

  function onResize() {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.offsetWidth, container.offsetHeight );
  }
  window.addEventListener('resize', onResize);
}
