import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * SlideToAccept Component
 * Allows worker to drag or slide a slider handle from LEFT to RIGHT to accept a job offer.
 * Prevents accidental taps, gives tactile feedback, and works seamlessly on touch and desktop mouse.
 */
export default function SlideToAccept({
  onAccept,
  isAccepting = false,
  label = 'Slide to Accept',
  disabled = false,
  height = 46,
  successText = 'Accepted! 🎉'
}) {
  const containerRef = useRef(null);
  const [dragProgress, setDragProgress] = useState(0); // 0 to 1
  const [isDragging, setIsDragging] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const getMaxDrag = () => {
    if (!containerRef.current) return 180;
    return containerRef.current.clientWidth - height;
  };

  const handleStart = (clientX) => {
    if (disabled || isAccepting || isCompleted) return;
    setIsDragging(true);
    startXRef.current = clientX;
    currentXRef.current = clientX;
  };

  const handleMove = useCallback((clientX) => {
    if (!isDragging || disabled || isAccepting || isCompleted) return;
    const maxDrag = getMaxDrag();
    if (maxDrag <= 0) return;

    const delta = Math.max(0, Math.min(clientX - startXRef.current, maxDrag));
    const progress = delta / maxDrag;
    setDragProgress(progress);

    // Auto-complete if dragged past 75%
    if (progress >= 0.75) {
      completeSlide();
    }
  }, [isDragging, disabled, isAccepting, isCompleted]);

  const handleEnd = useCallback(() => {
    if (!isDragging || isCompleted) return;
    setIsDragging(false);

    if (dragProgress >= 0.70) {
      completeSlide();
    } else {
      // Snap back to left
      setDragProgress(0);
    }
  }, [isDragging, dragProgress, isCompleted]);

  const completeSlide = () => {
    setIsDragging(false);
    setDragProgress(1);
    setIsCompleted(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
    if (onAccept) {
      onAccept();
    }
  };

  // Allow clicking anywhere on the bar to smoothly animate from left to right
  const handleBarClick = () => {
    if (disabled || isAccepting || isCompleted) return;
    let step = 0;
    const interval = setInterval(() => {
      step += 0.2;
      if (step >= 1) {
        clearInterval(interval);
        completeSlide();
      } else {
        setDragProgress(step);
      }
    }, 25);
  };

  // Mouse Listeners
  const onMouseDown = (e) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  // Touch Listeners
  const onTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      handleStart(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    const onWindowMouseMove = (e) => handleMove(e.clientX);
    const onWindowMouseUp = () => handleEnd();
    const onWindowTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };
    const onWindowTouchEnd = () => handleEnd();

    if (isDragging) {
      window.addEventListener('mousemove', onWindowMouseMove);
      window.addEventListener('mouseup', onWindowMouseUp);
      window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
      window.addEventListener('touchend', onWindowTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  const thumbSize = height - 6;
  const containerWidth = containerRef.current?.clientWidth || 240;
  const maxDrag = Math.max(80, containerWidth - thumbSize - 6);
  const currentLeft = dragProgress * maxDrag;

  return (
    <div
      ref={containerRef}
      onClick={handleBarClick}
      style={{
        position: 'relative',
        height: `${height}px`,
        width: '100%',
        minWidth: '180px',
        maxWidth: '100%',
        backgroundColor: isCompleted || isAccepting ? '#15803d' : '#0f172a',
        borderRadius: `${height / 2}px`,
        overflow: 'hidden',
        userSelect: 'none',
        cursor: disabled || isAccepting || isCompleted ? 'default' : 'pointer',
        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        transition: isDragging ? 'none' : 'background-color 0.3s ease'
      }}
    >
      {/* Filled Track from Left to Right */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${Math.max(0, currentLeft + thumbSize + 6)}px`,
          backgroundColor: '#16a34a',
          transition: isDragging ? 'none' : 'width 0.25s ease',
          borderRadius: `${height / 2}px 0 0 ${height / 2}px`
        }}
      />

      {/* Center Prompt Label */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          textAlign: 'center',
          color: '#f8fafc',
          fontSize: '0.85rem',
          fontWeight: 700,
          letterSpacing: '0.02em',
          pointerEvents: 'none',
          opacity: isCompleted || isAccepting ? 1 : Math.max(0.2, 1 - dragProgress * 1.5),
          transition: 'opacity 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          paddingLeft: `${thumbSize / 2}px`
        }}
      >
        {isAccepting ? (
          <span>⏳ Accepting...</span>
        ) : isCompleted ? (
          <span>{successText}</span>
        ) : (
          <>
            <span>{label}</span>
            <span style={{ animation: 'bounceX 1.5s infinite ease-in-out', display: 'inline-block' }}>➔</span>
          </>
        )}
      </div>

      {/* Draggable Worker Handle / Thumb */}
      <div
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        style={{
          position: 'absolute',
          left: `${currentLeft + 3}px`,
          top: '3px',
          width: `${thumbSize}px`,
          height: `${thumbSize}px`,
          borderRadius: '50%',
          backgroundColor: isCompleted ? '#ffffff' : '#22c55e',
          color: isCompleted ? '#16a34a' : '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 900,
          boxShadow: '0 3px 8px rgba(0, 0, 0, 0.3)',
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: isDragging ? 'none' : 'left 0.25s ease, background-color 0.2s ease',
          zIndex: 2
        }}
      >
        {isAccepting ? '⏳' : isCompleted ? '✓' : '👷'}
      </div>

      <style>{`
        @keyframes bounceX {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
