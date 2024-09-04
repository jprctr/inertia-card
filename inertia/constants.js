// Constants

export const margin = 0.1;
export const radius = 0.05; // border radius for images expressed as % of height
export const textHeight = 1024;
export const speeds = {
  stopped: 0,
  default: -0.001,
  arrowLeft: 0.05,
  arrowRight: -0.05,
  dragMod: 0.5,
  wheelMod: 0.001,
  tolerance: 0.0001, // smallest value we care about
};

export const textStyles = /* css */`
  .inertia-text-container {
    font-family: 'Nerko One', sans-serif;
    height: 100%;
    display: flex;
    flex-direction: column;
    font-size: 1rem;
  }
  .inertia-text {
    position: relative;
    display: flex;
    flex-direction: column;
    margin-top: auto;
    padding: 3em 4em;
    max-width: 48em;
    min-height: 12em;
    gap: 1.5em;
    color: white;
    text-shadow: 0 0 0.5em #27253d;
  }
  .inertia-text .inertia-title span {
    font-size: 2.75em;
    font-weight: 600;
  }
  .inertia-text .inertia-description span {
    font-size: 2.25em;
    line-height: 1.5em;
    font-weight: 400;
  }
`;
