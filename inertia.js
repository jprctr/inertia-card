import * as THREE from 'three';

const vertexShader = `
    uniform float time;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      // gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      float z = sin(position.x * 0.1 + time);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, z, 1.0);
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

      float minX = -xy.x;
      float maxX = xy.x;
      float minY = -xy.y;
      float maxY = xy.y;

      if ((pos.x <= minX || pos.x >= maxX) && (pos.y <= minY || pos.y >= maxY)) {
        vec2 bl = pos + xy;
        float pBL = length(max(abs(bl), 0.0));

        vec2 br = vec2(pos.x - xy.x, pos.y + xy.y);
        float pBR = length(max(abs(br), 0.0));

        vec2 tr = pos - xy;
        float pTR = length(max(abs(tr), 0.0));

        vec2 tl = vec2(pos.x + xy.x, pos.y - xy.y);
        float pTL = length(max(abs(tl), 0.0));

        textureColor.a = step(pBL, radius) + step(pBR, radius) + step(pTR, radius) + step(pTL, radius);
      }

      gl_FragColor = textureColor;
    }
  `;

export function SetupScene(containerId, inputImages) {
  const textureLoader = new THREE.TextureLoader();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xffffff );
  const container = document.getElementById(containerId);
  const camera = new THREE.PerspectiveCamera( 75, container.offsetWidth / container.offsetHeight, 0.1, 1000 );
  // camera.position.z = 1;
  camera.position.z = 16;

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize( container.offsetWidth, container.offsetHeight );
  container.appendChild( renderer.domElement );

  const meshes = [];

  const margin = 0.1;
  // might need individual geometries as well
  const aspect = 1.66; // aspect ratio of image(s) - calc in loop // image.width / image.height ?
  const radius = 0.1; // border radius for images expressed as % of height
  const planeWidth = aspect * 16; // maybe just reuse the other var
  const geometry = new THREE.PlaneGeometry(planeWidth, 1 * 16, 16, 16); // might need more w/h segments for clean bending

  let xOffset = 0;
  inputImages.forEach((image, index) => {
    const texture = textureLoader.load(image);
    const uniforms = {
      time: { type: 'f', value: 0 },
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
      index,
      planeWidth,
      xOffset,
    };
    xOffset += (planeWidth + margin);
    meshes.push(mesh);
    scene.add(mesh);
  });

  const fullWidth = meshes.map(c => (c.userData.planeWidth + margin)).reduce((a, v) => a + v, 0);

  let currentOffset = -fullWidth / 4 * 3;
  function animate() {
    meshes.forEach(mesh => {
      // this calc will need to be reworked for variable aspect ratios
      mesh.position.x = fullWidth / 2 + (mesh.userData.xOffset + currentOffset) % fullWidth;

      mesh.material.uniforms.time.value += 0.01;
    });
    currentOffset -= 0.01;
    renderer.render( scene, camera );
  }
  
  renderer.setAnimationLoop( animate );

  function onResize() {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.offsetWidth, container.offsetHeight );
  }

  window.addEventListener( 'resize', onResize );
}
