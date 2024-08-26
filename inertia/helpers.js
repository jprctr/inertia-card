// Helper Functions

import { CanvasTexture, Raycaster, Vector2 } from 'three';

import { textStyles } from './constants.js';

async function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export async function generateTextTexture(slide, width, height) {
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
    const texture = new CanvasTexture(canvas);
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
    blobToBase64(blob).then(url => {
      const image = new Image();
      image.onload = () => {
        // draw to canvas, create texture from canvas
        context.drawImage(image, 0, 0, image.width, image.height);
        URL.revokeObjectURL(url);
        // return canvas as texture
        return resolve(texture);
      }
      image.src = url;
    });
  });
}

const raycaster = new Raycaster();
export function updateCursorHover(container, cursor, camera, cards) {
  const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = container;
  const pointer = new Vector2(
    ((cursor.x - offsetLeft) / offsetWidth) * 2 - 1,
    (((cursor.y - offsetTop) / offsetHeight) * 2 - 1) * -1,
  );
  raycaster.setFromCamera(pointer, camera);
  const [intersect] = raycaster.intersectObjects(cards);
  if (intersect) {
    container.style.cursor = 'pointer';
  } else {
    container.style.cursor = 'default';
  }
}
