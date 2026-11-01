import { useEffect } from 'react';
import { Invert } from 'mouse-animations';

export default function CursorFollower() {
  useEffect(() => {
    // Check if the user is on a desktop device with a mouse/trackpad pointer
    if (typeof window === 'undefined' || !window.matchMedia('(pointer: fine)').matches) {
      return;
    }

    // Initialize Invert cursor effect from design/cursor_move.tsx
    const invert = new Invert({
      color: '#ffffff',
      size: 56,
      smoothness: 0.45,
      hideDefault: false, // Keeps native pointer for precision while adding the fluid inverted glass lens
    });

    return () => {
      invert.destroy();
    };
  }, []);

  return null;
}

