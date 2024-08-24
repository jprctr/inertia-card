import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { margin, radius, speeds } from './constants.js';
import { vertexShader, fragmentShader, waveShader } from './shaders.js';
import { generateTextTexture } from './helpers.js';

export default async function SetupInertia(containerId, slides) {

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
  const renderElement = renderer.domElement;
  container.appendChild(renderElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const shaderPass = new ShaderPass(waveShader);
  shaderPass.uniforms['aspect'].value = container.offsetWidth / container.offsetHeight;
  composer.addPass(shaderPass);

  // Progress Indicator
  const progressGroup = document.createElement('div');
  progressGroup.className = 'inertia-progress';
  const backgroundRing = document.createElement('div');
  backgroundRing.className = 'inertia-progress-ring inertia-progress-ring-background';
  progressGroup.appendChild(backgroundRing);
  const progressRing = document.createElement('div');
  progressRing.className = 'inertia-progress-ring';
  progressRing.style = 'clip-path: polygon(0% 0%, 0% 0%, 0% 0%);'
  progressGroup.appendChild(progressRing);
  container.appendChild(progressGroup);

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
  const firstCardWidth = cards[0]?.userData?.aspect || 0;

  let speed = speeds.stopped;
  let currentOffset = -halfWidth - firstCardWidth / 2; // this starts at about 0
  function animate() {
    cards.forEach(card => {
      card.position.x = ((card.userData.xOffset + currentOffset + bigOffset) % fullWidth) - halfWidth;
    });

    //
    // break this progress block out
    const progressOffset = currentOffset - (halfWidth - (firstCardWidth / 2));
    const progress = -(progressOffset % fullWidth) * 0.0945; // 0.1 // ~ 0 - 1
    const center = 50;
    const radialProgress = progress * Math.PI * 2 - (Math.PI / 2);
    const px = center + Math.cos(radialProgress) * 100;
    const py = center + Math.sin(radialProgress) * 100;

    const px2 = center + Math.cos((radialProgress + 0.1)) * 100;
    const py2 = center + Math.sin((radialProgress + 0.1)) * 100;
    progressRing.style = `clip-path: polygon(${center}% ${center}%, ${px}% ${py}%, ${px2}% ${py2}%);`;

    const corners = [ // clockwise corners to keep our shape right
        `100% 0%`, // tr
        `100% 100%`, // br
        `0% 100%`, // bl
        `0% 0%`, // tl
      ];
    const cornerOffset = 0.125; // increase offset by 1/8th of the circle
    const cornerIndex = Math.floor((progress + cornerOffset) * corners.length);
    const displayedCorners = corners.slice(0, cornerIndex).join(', ');
    /*
      polygon consists of
      1. center point of circle
      2. top center point (12 o'clock)
      3. any corner our progress indicator has already passed, moving clockwise
      4. the progress indicator current position (px, py)
    */
    progressRing.style = `clip-path: polygon(${center}% ${center}%, ${center}% 0% ${displayedCorners.length && `, ${displayedCorners}` || ''}, ${px}% ${py}%);`;
    //
    //

    const effectiveSpeed = (speed || speeds.default); // default to very slow scroll if no input
    currentOffset += effectiveSpeed;

    shaderPass.uniforms['time'].value += 0.025;
    shaderPass.uniforms['amplitude'].value = effectiveSpeed;

    composer.render();
  }

  renderer.setAnimationLoop(animate);

  // Event Handlers

  let slowHandle;
  function slow(increment = 0.1) { // use this instead of instantly setting to stopped for smoother feel
    clearTimeout(slowHandle);
    speed = THREE.MathUtils.lerp(speed, speeds.stopped, increment);
    if (Math.abs(speed) > speeds.tolerance) {
      slowHandle = setTimeout(() => slow(), 100);
    } else {
      speed = speeds.stopped;
    }
  }

  progressGroup.addEventListener('click', (event) => {
    /*
      quick implementation:
      can we invert the current position / progress
      and be more precise than this
      without breaking the animation?
    */

    // A
    // speed = -0.2;
    // slow(0.825);

    // B
    speed = -0.71;
    slow(0.96);

  });

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
  renderElement.addEventListener('pointerdown', onPointerdown);

  function onPointerup(event) {
    if (!dragging) {
      onClick(event);
    }
    resetDrag();
  }
  renderElement.addEventListener('pointerup', onPointerup);

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
  renderElement.addEventListener('pointermove', onPointermove);

  // Resize

  function onResize() {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.offsetWidth, container.offsetHeight );
  }
  window.addEventListener('resize', onResize);
}
