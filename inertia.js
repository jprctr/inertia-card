import * as THREE from 'three';

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

export async function SetupScene(containerId, slides) {
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

  const margin = 0.1;
  const radius = 0.05; // border radius for images expressed as % of height

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

  const fullWidth = meshes.map(c => (c.userData.aspect + margin)).reduce((a, v) => a + v, 0);

  let currentOffset = -fullWidth / 4 * 3;
  function animate() {
    meshes.forEach(mesh => {
      mesh.position.x = fullWidth / 2 + (mesh.userData.xOffset + currentOffset) % fullWidth;
    });
    currentOffset -= 0.01;
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);

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
