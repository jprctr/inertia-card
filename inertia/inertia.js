import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { margin, radius, speeds, textHeight } from './constants.js';
import { vertexShader, fragmentShader, waveShader } from './shaders.js';
import {
  getCameraOffset,
  generateTextTexture,
  generateCroppedTexture,
  updateCursorHover
} from './helpers.js';

export default async function SetupInertia(containerId, slides, isVertical = false) {

  // Setup

  const windowAspect = window.innerWidth / window.innerHeight;

  const container = document.getElementById(containerId);
  const containerAspect = container.offsetWidth / container.offsetHeight;

  const textureLoader = new THREE.TextureLoader();
  const raycaster = new THREE.Raycaster();
  const scene = new THREE.Scene();
  const cursor = new THREE.Vector2();

  const camera = new THREE.PerspectiveCamera(75, containerAspect, 0.1, 1000);
  camera.position.z = isVertical ? getCameraOffset(16 / 9, camera) : 0.85;

  const renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setClearColor(0xffffff, 0);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.offsetWidth, container.offsetHeight);
  const renderElement = renderer.domElement;
  container.appendChild(renderElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const shaderPass = new ShaderPass(waveShader);
  shaderPass.uniforms['aspect'].value = containerAspect;
  shaderPass.uniforms['vertical'].value = isVertical;
  composer.addPass(shaderPass);

  // Fallback Tabbable Menu & Links
  const fallbackGroup = document.createElement('div');
  fallbackGroup.role = 'menu';
  fallbackGroup['aria-label'] = 'list of items';
  const fallbackList = document.createElement('ol');
  fallbackGroup.appendChild(fallbackList);
  slides.forEach(({ title, description, link}) => {
    const li = document.createElement('li');
    li.role = 'menuitem';
    const a = document.createElement('a');
    a.href = link;
    a.textContent = title;
    const p = document.createElement('p');
    p.textContent = description;
    li.appendChild(a)
    li.appendChild(p);
    fallbackList.appendChild(li);
  });
  renderElement.appendChild(fallbackGroup);

  // Construct Objects & assign positions
  const inputCards = await Promise.all(
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

          // use the same height to keep text scale consistent
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

  const cardGroup = new THREE.Group();
  cardGroup.name = 'cardGroup';

  // assign positions
  let xOffset = 0;
  let yOffset = 0;
  inputCards.forEach(card => {
    if (isVertical) {
      const height = 1;
      card.userData.yOffset = yOffset;
      yOffset += height + margin;
      cardGroup.add(card);
    } else {
      const width = card.userData.aspect;
      card.userData.xOffset = xOffset + width / 2;
      xOffset += width + margin;
      cardGroup.add(card);
    }
  });

  scene.add(cardGroup);
  let cards = cardGroup.children;

  // Render

  const fullWidth = cards.map(card => (card.userData.aspect + margin)).reduce((a, v) => a + v, 0);
  const halfWidth = fullWidth * 0.5;
  const fullHeight = cards.map(card => (1 + margin)).reduce((a, v) => a + v, 0) - 1;
  const bigOffset = 100000 * fullWidth; // helps make it "infinite" in either direction
  const firstCardWidth = cards[0]?.userData?.aspect || 0;
  const scaledYOffset = (camera.position.z - 1) * 0.5;

  let speed = speeds.stopped;
  let initOffset = -halfWidth - (firstCardWidth * 0.5);
  let currentOffset = isVertical ? Math.max(0, scaledYOffset) : initOffset; // this starts at about 0
  function animate() {
    // update card positions
    cards.forEach(card => {
      // card.position.x = ((card.userData.xOffset + currentOffset + bigOffset) % fullWidth) - halfWidth;
      if (isVertical) {
        card.position.x = 0;
        // card.position.y = ((card.userData.yOffset + currentOffset + bigOffset) % fullWidth) - halfWidth;
        card.position.y = -card.userData.yOffset + currentOffset; // ((card.userData.yOffset + currentOffset + bigOffset) % fullHeight) - halfHeight;
      } else {
        card.position.x = ((card.userData.xOffset + currentOffset + bigOffset) % fullWidth) - halfWidth;
        card.position.y = 0;
      }
    });

    // update cursor style
    dragging || updateCursorHover(container, cursor, camera, cards);

    // update speed and offset
    const defaultSpeed = isVertical ? speeds.stopped : speeds.default;
    const effectiveSpeed = speed || defaultSpeed; // default to very slow scroll if no input
    currentOffset += effectiveSpeed;
    if (isVertical) {
      const clampedOffset = Math.min(Math.max(currentOffset, 0), fullHeight);
      if (clampedOffset !== currentOffset) {
        currentOffset = clampedOffset;
        slow();
      }
    }

    // update shader uniforms
    shaderPass.uniforms['time'].value += 0.025;
    shaderPass.uniforms['amplitude'].value = effectiveSpeed;

    composer.render();
  }

  renderer.setAnimationLoop(animate);

  // Event Handlers

  let slowHandle;
  // function slow(increment = 0.1) { // use this instead of instantly setting to stopped for smoother feel
  function slow(increment = 0.25) { // use this instead of instantly setting to stopped for smoother feel
    clearTimeout(slowHandle);
    speed = THREE.MathUtils.lerp(speed, speeds.stopped, increment);
    if (Math.abs(speed) > speeds.tolerance) {
      // slowHandle = setTimeout(() => slow(), 100);
      slowHandle = setTimeout(() => slow(), 60);
    } else {
      speed = speeds.stopped;
    }
  }

  const keySpeeds = {
    'ArrowLeft': speeds.arrowLeft,
    'ArrowUp': speeds.arrowLeft,
    'ArrowRight': speeds.arrowRight,
    'ArrowDown': speeds.arrowRight,
  };
  const validKeys = Object.keys(keySpeeds);

  function onKeyDown(event) {
    const { key } = event;
    if (validKeys.includes(key)) {
      const reverse = isVertical ? -1 : 1;
      speed = keySpeeds[key] * reverse || speeds.stopped;
    }
  }
  window.addEventListener('keydown', onKeyDown);

  function onKeyUp(event) {
    const { key } = event;
    if (validKeys.includes(key)) {
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
      slow();
    }, 60);
  }
  renderElement.addEventListener('wheel', onWheel);

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
        window.open(link, '_self');
      }
    }
  }

  let pointerdown = false;
  let dragging = false;
  let lastX = null;
  let lastY = null;

  function resetDrag() {
    pointerdown = false;
    dragging = false;
    lastX = null;
    lastY = null;
    slow();
  }
  window.addEventListener('blur', resetDrag);
  window.addEventListener('pointerout', resetDrag);

  function onPointerdown() {
    resetDrag();
    pointerdown = true;
  }
  renderElement.addEventListener('pointerdown', onPointerdown);

  function onPointerup(event) {
    if (!dragging) {
      onClick(event);
    }
    resetDrag();
  }
  renderElement.addEventListener('pointerup', onPointerup);

  function onPointermove(event) {
    // get current cursor position
    const { clientX, clientY } = event;
    cursor.x = clientX;
    cursor.y = clientY;
    // handle Drag
    if (pointerdown) {
      container.style.cursor = 'grabbing';
      dragging = true;
      const { screenX, screenY } = event;
      let deltaX = 0;
      if (lastX === null) {
        lastX = screenX;
      } else {
        deltaX = screenX - lastX;
      }
      let deltaY = 0;
      if (lastY === null) {
        lastY = screenY;
      } else {
        deltaY = screenY - lastY;
      }
      const dragDistance = isVertical
        ? (deltaY * -1) / container.offsetHeight
        : deltaX / container.offsetWidth;
      speed = dragDistance * speeds.dragMod;
    }
  }
  renderElement.addEventListener('pointermove', onPointermove);

  // Resize

  function onResize() {
    // mobile updates
    const windowAspect = window.innerWidth / window.innerHeight;
    shaderPass.uniforms['vertical'].value = isVertical;
    // swap cards
    // scene.remove(isVertical ? horizontalCards : verticalCards);
    // const cardGroup = isVertical ? verticalCards : horizontalCards;
    // scene.add(cardGroup);
    // cards = cardGroup.children;
    // renderer updates
    const containerAspect = container.offsetWidth / container.offsetHeight;
    shaderPass.uniforms['aspect'].value = containerAspect;
    camera.aspect = containerAspect;
    camera.updateProjectionMatrix();
    camera.position.z = isVertical ? getCameraOffset(16 / 9, camera) : 0.85;
    if (isVertical) {
      const scaledYOffset = (camera.position.z - 1) * 0.5;
      currentOffset = Math.max(0, scaledYOffset);
    } else {
      currentOffset = initOffset;
    }
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    composer.setPixelRatio(window.devicePixelRatio);
    composer.setSize(container.offsetWidth, container.offsetHeight);
  }
  window.addEventListener('resize', onResize);
}
