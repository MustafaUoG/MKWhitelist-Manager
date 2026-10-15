import { $, toast } from './ui.js';

// The secret meow button. Clicking the logo at the top of the sidebar five times quickly reveals it,
// and doing it again hides it. The meow was recorded by a friend of the project, with their permission.

const CLICKS_TO_UNLOCK = 5;
// Clicks further apart than this start the count again
const MAX_CLICK_GAP_MS = 600;

const WIGGLE = [
  { transform: 'rotate(0)' },
  { transform: 'rotate(-18deg) scale(1.2)' },
  { transform: 'rotate(14deg) scale(1.2)' },
  { transform: 'rotate(0)' },
];

export function setUpMeow({ unlocked }) {
  const logo = $('.sidebar .brand-logo');
  const button = $('#meow-button');
  const sound = new Audio('../../assets/ghostymeow.mp3');

  let clicks = 0;
  let lastClickAt = 0;

  function meow() {
    // Start from the beginning, even if the last meow is still playing
    sound.currentTime = 0;
    sound.play().catch(() => {
      // Nothing useful to do if it won't play. It's a meow.
    });

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      button.querySelector('.icon').animate(WIGGLE, { duration: 400, easing: 'ease-in-out' });
    }
  }

  async function setUnlocked(value) {
    unlocked = value;
    button.hidden = !unlocked;

    const result = await window.api.setMeowUnlocked(unlocked);
    if (!result.ok) {
      toast(`Couldn't save that: ${result.error}`, 'error');
    }
  }

  logo.addEventListener('click', () => {
    const now = Date.now();
    clicks = now - lastClickAt > MAX_CLICK_GAP_MS ? 1 : clicks + 1;
    lastClickAt = now;
    if (clicks < CLICKS_TO_UNLOCK) {
      return;
    }

    clicks = 0;
    setUnlocked(!unlocked);
    if (unlocked) {
      meow();
      toast('You found the secret meow button');
    } else {
      toast('Meow button hidden');
    }
  });

  button.hidden = !unlocked;
  button.addEventListener('click', meow);
}
