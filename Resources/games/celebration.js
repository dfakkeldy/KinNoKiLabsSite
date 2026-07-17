import { prefersReducedMotion } from './controller-common.js';

export function celebrate({ root, reducedMotion = prefersReducedMotion(), particleCount = 20 } = {}) {
  if (!root || reducedMotion) return { dispose: () => {} };
  const overlay = document.createElement('div');
  overlay.className = 'game-celebration';
  overlay.setAttribute('aria-hidden', 'true');
  let remaining = particleCount;
  const done = () => { remaining -= 1; if (remaining <= 0) dispose(); };
  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement('span');
    particle.className = 'game-celebration-particle';
    particle.style.setProperty('--particle-index', String(index));
    particle.addEventListener('animationend', done, { once: true });
    overlay.append(particle);
  }
  function dispose() { overlay.remove(); }
  root.append(overlay);
  return { dispose };
}
