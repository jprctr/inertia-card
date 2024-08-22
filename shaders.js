// Shaders

export const vertexShader = `
  varying vec2 vUv;

  void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

export const fragmentShader = `
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
