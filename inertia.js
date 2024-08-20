import * as THREE from 'three';

export function SetupScene(containerId, inputImages) {
  const textureLoader = new THREE.TextureLoader();
  const scene = new THREE.Scene();
  const container = document.getElementById(containerId);
  const camera = new THREE.PerspectiveCamera( 75, container.offsetWidth / container.offsetHeight, 0.1, 1000 );
  camera.position.z = 1;

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize( container.offsetWidth, container.offsetHeight );
  container.appendChild( renderer.domElement );

  const meshes = [];

  const margin = 0.1;
  // might need individual geometries as well
  const planeWidth = 1.66; // image.width / image.height ?
  const geometry = new THREE.PlaneGeometry(planeWidth, 1, 1, 1); // might need more w/h segments for clean bending

  let xOffset = 0;
  inputImages.forEach((image, index) => {
    // replace material w/ teture material
    const texture = textureLoader.load(image);
    const material = new THREE.MeshBasicMaterial( { map: texture } );
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
