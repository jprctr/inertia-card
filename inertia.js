import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { vertexShader, fragmentShader, waveShader } from './shaders.js';

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

const textStyles = `
  .inertia-text-container {
    font-family: sans-serif;
    height: 100%;
    display: flex;
    flex-direction: column;
    font-size: 1rem;
  }
  .inertia-text {
    position: relative;
    display: flex;
    flex-direction: column;
    margin-top: auto;
    padding: 3em 4em;
    max-width: 48em;
    min-height: 12em;
    gap: 1.5em;
    color: white;
    text-shadow: 0 0 0.5em black;
  }
  .inertia-text .inertia-title span {
    font-size: 2.75em;
    font-weight: 600;
  }
  .inertia-text .inertia-description span {
    font-size: 2.25em;
    line-height: 1.5em;
    font-weight: 400;
  }
`;

function generateTextTexture(slide, width, height) {
  return new Promise((resolve) => {
    const { title, description } = slide;

    const text = `
      <div class="inertia-text">
        <div class="inertia-title">
          <span>
            ${title}
          </span>
        </div>
        <div class="inertia-description">
          <span>
            ${description}
          </span>
        </div>
      </div>
    `;

    // create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    // insert text into canvas
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
        <style>${textStyles}</style>
        <foreignObject width="100%" height="100%">
          <div class="inertia-text-container" xmlns="http://www.w3.org/1999/xhtml">${text}</div>
        </foreignObject>
      </svg>
    `;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    // draw to canvas, create texture from canvas
    image.onload = () => {
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      // return canvas as texture
      return resolve(new THREE.CanvasTexture(canvas));
    }
    image.src = url;
  });
}

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

  const shaderPass = new ShaderPass(waveShader);
  shaderPass.uniforms['aspect'].value = container.offsetWidth / container.offsetHeight;
  composer.addPass(shaderPass);

  // Construct Objects & assign positions

  const cards = await Promise.all(
    slides.map((slide) => (
      new Promise(resolve => (
        // load the image as a texture
        textureLoader.load(slide.image, (texture) => {
          // create card group and save shared properties
          const card = new THREE.Group();
          const aspect = texture.image.width / texture.image.height;
          const geometry = new THREE.PlaneGeometry(aspect, 1, 1, 1);
          card.userData = {
            ...slide,
            aspect,
          };

          // create image mesh
          const uniforms = {
            map: { type: 't', value: texture },
            radius: { type: 'f', value: radius },
            aspect: { type: 'f', value: aspect },
          };
          const imageMaterial = new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
          });
          const imageMesh = new THREE.Mesh(geometry, imageMaterial);
          card.add(imageMesh);

          const textHeight = 1024; // use the same height to keep text scale consistent
          const textWidth = textHeight * aspect; // match image aspect ratio

          // generate text texture w/ matching dimensions
          generateTextTexture(slide, textWidth, textHeight).then((textTexture) => {
            // create text mesh
            const textMaterial = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true, });
            const textMesh = new THREE.Mesh(geometry, textMaterial);
            card.add(textMesh);

            // return the assembled card
            return resolve(card);
          });
        })
      ))
    ))
  );

  // assign positions
  let xOffset = 0;
  cards.forEach(card => {
    const width = card.userData.aspect;
    card.userData.xOffset = xOffset + width / 2;
    xOffset += width + margin;
    scene.add(card);
  });

  // Render

  const fullWidth = cards.map(card => (card.userData.aspect + margin)).reduce((a, v) => a + v, 0);
  const halfWidth = fullWidth * 0.5;
  const bigOffset = 100000 * fullWidth; // helps make it "infinite" in either direction

  let speed = speeds.stopped;
  let currentOffset = 0;
  function animate() {
    cards.forEach(card => {
      card.position.x = ((card.userData.xOffset + currentOffset + bigOffset) % fullWidth) - halfWidth;
    });

    const effectiveSpeed = (speed || speeds.default); // default to very slow scroll if no input
    currentOffset += effectiveSpeed;

    shaderPass.uniforms['time'].value += 0.025;
    shaderPass.uniforms['amplitude'].value = effectiveSpeed;

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
    const [intersect] = raycaster.intersectObjects(scene.children);
    if (intersect) {
      const { object } = intersect;
      const { parent } = object;
      const { userData } = parent;
      const { link } = userData;
      if (link) {
        window.open(link); // new tab is nicer for dev
        // window.open(link, '_self'); // link directly in this tab later
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
