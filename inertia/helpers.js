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

export function generateCroppedTexture(image, width, height) {
  const canvas = document.createElement('canvas');
  const texture = new CanvasTexture(canvas);
  const context = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  const yOffset = (image.height - height) / 2 * -1;
  context.drawImage(image, 0, yOffset, image.width, image.height);
  return texture;
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

export function updateProgressRing(currentOffset, initOffset, fullWidth, progressRing) {
  const progressOffset = currentOffset - initOffset;
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
  const cornerIndex = progress < 0 && progress > -cornerOffset // avoid negative fill
    ? corners.length
    : Math.floor((progress + cornerOffset) * corners.length);
  const displayedCorners = corners.slice(0, cornerIndex).join(', ');
  /*
    polygon consists of
    1. center point of circle
    2. top center point (12 o'clock)
    3. any corner our progress indicator has already passed, moving clockwise
    4. the progress indicator current position (px, py)
  */
  progressRing.style = `clip-path: polygon(${center}% ${center}%, ${center}% 0% ${displayedCorners.length && `, ${displayedCorners}` || ''}, ${px}% ${py}%);`;
}
