/**
 * useDragDetection - Custom hook to detect drag vs click events
 * Extracted from Launcher component to improve code organization
 */

import { useRef } from 'react';

export const useDragDetection = () => {
  const dragStatus = useRef({
    x: 0,
    y: 0
  });

  const onMouseDown = (event) => {
    dragStatus.current.x = event.clientX;
    dragStatus.current.y = event.clientY;
  };

  const onMouseUp = (event, callback) => {
    const distanceMoved =
      Math.abs(dragStatus.current.x - event.clientX) +
      Math.abs(dragStatus.current.y - event.clientY);

    // If moved less than 15px, treat as click
    if (distanceMoved < 15) {
      callback();
    }
  };

  return { onMouseDown, onMouseUp };
};
