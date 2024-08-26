// Shaders

export const vertexShader = /* glsl */`
  varying vec2 vUv;
  uniform float inverseAspect;
  // uniform float scale;

  void main() {
      vUv = uv;
      // vUv = uv * nativeAspect;

      vec3 pos = position;
      // pos *= scale;
      // pos.x *= scale;
      // pos.y *= scale;
      pos.x *= inverseAspect;

      // vUv = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      // gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const defaultVertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fragmentShader = /* glsl */`
  uniform sampler2D map;
  uniform float radius;
  uniform float aspect;
  uniform float nativeAspect;
  uniform float inverseAspect;
  uniform float scale;
  varying vec2 vUv;

  void main() {
    vec4 textureColor = texture2D(map, vUv);

    vec2 pos = vUv;
    
    pos = pos * 2.0 - 1.0;

    // pos /= scale;
    // pos.y * 2.0;
    pos.x /= 5.0;

    // pos *= scale;
    // pos *= scale - scale * 0.5;
    // pos /= scale;
    //
    // pos *= inverseAspect;
    // pos.x *= aspect;
    // pos.x * inverseAspect;
    // pos.y *= inverseAspect;

    //
    // pos.y;
    // pos.y *= 2.0;

    // pos *= inverseAspect;
    // pos /= scale;



    // pos 
    
    // pos.y 
    // pos.y *= scale / 2.0;


    // pos /= scale;
    // pos.x *= aspect;

    // pos *= scale;
    // pos.y *= aspect;

    // pos.x *= scale;
    // pos.y *= max(1.0, scale);
    // pos.x *= inverseAspect;
    // pos *= inverseAspect;
    // pos.x *= aspect;
    // pos.x *= inverseAspect;
    // pos.y *= aspect;
    // pos.y *= 2.0;
    // pos 

    // scale this

    // vec2 xy = vec2(1.0 - radius, 1.0 - radius);
    
    // vec2 xy = vec2(inverseAspect / scale - radius, 1.0 / scale - radius);
    // vec2 xy = vec2(inverseAspect - radius, 1.0 - radius);

    // vec2 xy = vec2(1.0, 2.0);

    // vec2 xy = vec2(nativeAspect - radius, 1.0 - radius);
    // vec2 xy = vec2(aspect - radius, 1.0 - radius);
    // vec2 xy = vec2(aspect - radius, 1.0 * inverseAspect - radius);
    // xy /= inverseAspect;


    vec2 xy = vec2(aspect - radius, 1.0 - radius);
    // vec2 xy = vec2(nativeAspect - radius, 1.0 - radius);

    vec2 tr = pos - xy;
    float pTR = length(max((tr), 0.0));

    vec2 tl = vec2(pos.x + xy.x, pos.y - xy.y);
    float pTL = length(max(vec2(tl.x * -1.0, tl.y), 0.0));

    vec2 br = vec2(pos.x - xy.x, pos.y + xy.y);
    float pBR = length(max(vec2(br.x, br.y * -1.0), 0.0));

    vec2 bl = pos + xy;
    float pBL = length(max(vec2(bl.x * -1.0, bl.y * -1.0), 0.0));

    // textureColor.a = step(pTR, radius) * step(pTL, radius) * step(pBR, radius) * step(pBL, radius);
    textureColor.a = step(pTR, radius) * step(pTL, radius) * step(pBR, radius) * step(pBL, radius);

    gl_FragColor = textureColor;
  }
`;

export const waveShader = {
  name: 'WaveShader',
  uniforms: {
    'tDiffuse': { value: null },
    'aspect': { type: 'f', value: 0.0 },
    'time': { type: 'f', value: 0.0 },
    'amplitude': { type: 'f', value: 0.01 },
    'vertical': { type: 'bool', value: true },
  },
  // vertexShader,
  vertexShader: defaultVertexShader,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float aspect;
    uniform float time;
    uniform float amplitude;
    uniform bool vertical;
    varying vec2 vUv;

    void main() {
      vec2 waveUv = vUv;

      // normalize pos
      vec2 pos = vUv;
      pos = pos * 2.0 - 1.0;
      pos.x *= aspect;

      // set acceptable amplitude ranges
      // float ampMax = 0.15;
      float ampMax = 0.11;
      float ampMin = 0.01;
      float ampRange = ampMax - ampMin;

      // scale amplitude
      // float normalizedAmp = abs(amplitude) * 2.0; // from approx 0.0 - 0.5 to 0.0 - 1.0
      float normalizedAmp = abs(amplitude) * 5.0; // from approx 0.0 - 0.15 to 0.0 - 1.0
      float scaledAmp = ampMin + ampRange * normalizedAmp;
      // float scaledAmp = ampMax;
      float amp = max(ampMin, min(ampMax, scaledAmp));

      // apply wave
      if (vertical) {
        waveUv.x += sin(pos.y + time) * amp * pos.x * 0.5;
      } else {
        waveUv.y += sin(pos.x + time) * amp * pos.y;
      }
      // waveUv.y += sin(pos.x + time) * amp * pos.y;

      gl_FragColor = texture2D(tDiffuse, waveUv);

    }
  `,
};
