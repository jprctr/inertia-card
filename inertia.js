import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

export function SetupScene(containerId, itemsId) {
  const scene = new THREE.Scene();
  const container = document.getElementById(containerId);
  // const camera = new THREE.PerspectiveCamera( 75, container.offsetWidth / container.offsetHeight, 0.1, 1000 );
  const camera = new THREE.OrthographicCamera( container.offsetWidth / - 2, container.offsetWidth / 2, container.offsetHeight / 2, container.offsetHeight / - 2, 1, 1000 );
  
  const renderer = new CSS3DRenderer();
  renderer.setSize( container.offsetWidth, container.offsetHeight );
  container.appendChild( renderer.domElement );

  // grab the children of the target, position and add to scene
  const items = document.getElementById(itemsId).children;
  const cards = [];

  // let itemIndex = 0;
  const padding = 20; // idk 
  let itemOffset = padding;
  let maxItemHeight = 0;
  for (const item of items) {
    const itemCSSObject = new CSS3DObject( item );

    // we may need to recalculate these metrics on resize or just reset the whole thing
    itemCSSObject.userData = {
      initX: itemOffset + (item.offsetWidth / 2),
      width: item.offsetWidth,
    };
    itemCSSObject.position.x = itemCSSObject.userData.initX; // itemOffset + (item.offsetWidth / 2);
    itemCSSObject.position.y = 0;
    itemCSSObject.position.z = 0;

    cards.push(itemCSSObject);
    scene.add(itemCSSObject);

    itemOffset += item.offsetWidth + padding;
    maxItemHeight = Math.max(maxItemHeight, item.offsetHeight);
  }

  // camera.position.z = 480; // 640; // magic numbers... not needed now w/ orthographic

  function animate() {
    cards.forEach((c, i) => {
      c.position.x -= 2; // vary this value to change direction, intensity

      // clean this up and also check for the opposite direction
      if (c.position.x + c.userData.width / 2 + container.offsetWidth / 2 < 0) {
        c.position.x = c.userData.width / 2 + Math.max(...cards.map(ci => ci.position.x + ci.userData.width / 2 + padding)); // c.userData.initX + container.offsetWidth / 2;
      }
    });

    renderer.render( scene, camera );
    requestAnimationFrame( animate );
  }

  animate();

  function onWindowResize() {
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( container.offsetWidth, container.offsetHeight );
  }

  window.addEventListener( 'resize', onWindowResize );

}
