import * as THREE from 'three';

// Shaders

const vertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;

const fragmentShader = `
    uniform sampler2D map;
    uniform float radius;
    uniform float aspect;
    varying vec2 vUv;

    void main() {
      vec4 textureColor = texture2D(map, vUv);

      vec2 pos = vUv;
      pos = pos * 2.0 - 1.0;
      pos.x *= aspect;

      vec2 xy = vec2(aspect - radius, 1.0 - radius);

      vec2 tr = pos - xy;
      float pTR = length(max((tr), 0.0));

      vec2 tl = vec2(pos.x + xy.x, pos.y - xy.y);
      float pTL = length(max(vec2(tl.x * -1.0, tl.y), 0.0));

      vec2 br = vec2(pos.x - xy.x, pos.y + xy.y);
      float pBR = length(max(vec2(br.x, br.y * -1.0), 0.0));

      vec2 bl = pos + xy;
      float pBL = length(max(vec2(bl.x * -1.0, bl.y * -1.0), 0.0));

      textureColor.a = step(pTR, radius) * step(pTL, radius) * step(pBR, radius) * step(pBL, radius);

      gl_FragColor = textureColor;
    }
  `;

// Constants

const margin = 0.1;
const radius = 0.05; // border radius for images expressed as % of height
const speeds = {
  stopped: 0,
  default: -0.001,
  arrowLeft: -0.1,
  arrowRight: 0.1,
  wheelMod: 0.001,
  tolerance: 0.001, // smallest value we care about
};

export async function SetupScene(containerId, slides) {
  // Setup

  const container = document.getElementById(containerId);

  const textureLoader = new THREE.TextureLoader();
  const raycaster = new THREE.Raycaster();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xffffff );
  
  const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
  camera.position.z = 1;

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(container.offsetWidth, container.offsetHeight);
  container.appendChild(renderer.domElement);

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
    renderer.render(scene, camera);
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
  container.addEventListener('click', onClick);

  function onResize() {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.offsetWidth, container.offsetHeight );
  }
  window.addEventListener('resize', onResize);
}
