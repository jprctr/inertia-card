# Inertia Card

A little custom carousel animation using three.js

## Dependencies

- [three.js](https://threejs.org) imported from a CDN, described as "Option 2" in the [installation docs](https://threejs.org/docs/#manual/en/introduction/Installation)

## Running

From the `intertia-card` directory start a local server.
For example:
```bash
npx serve .
```
The contents of `index.html` should now be visible at (http://localhost:3000)

## Demo Implementation

`index.html` includes demo of the carousel in both horizontal and vertical scrolling modes

```
<script type="module">
  import SetupInertia from './inertia/inertia.js';
  const slides = new Array(7).fill(null).map((_, i) => ({
    title: `This is my title ${i + 1}`,
    description: `Lorem iosum dolor sit amet, consectetur adipiscing elit. Phasellus a enim.`,
    image: `/images/${i}.jpg`,
    link: `/my-link/${i}`,
  }));
  SetupInertia('inertiaContainerHorizontal', slides, false);
  SetupInertia('inertiaContainerVertical', slides, true);
</script>
```

## Shader Animation

`inertia/shaders.js` defines `waveShader`, which takes in uniforms named time and amplitude.

These uniforms are updated in the Three animation loop kicked off in `inertia/inertia.js`, with the amplitude mapped to scroll events such that faster dragging or scrolling through the carousel increases the bendy distortion of the cards.

![demo-gif](https://raw.githubusercontent.com/jprctr/inertia-card/main/inertia-demo.gif)

