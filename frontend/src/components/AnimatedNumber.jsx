import React, { useEffect, useRef, useState } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform
} from 'framer-motion';

export default function AnimatedNumber({ value, loading = false }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' });
  const shouldReduceMotion = useReducedMotion();
  const [hasStarted, setHasStarted] = useState(false);
  const count = useMotionValue(0);
  const spring = useSpring(count, { damping: 28, stiffness: 95 });
  const rounded = useTransform(spring, (latest) => Math.round(latest).toLocaleString());

  useEffect(() => {
    if (!isInView || loading) return undefined;

    if (shouldReduceMotion) {
      count.set(value);
      return undefined;
    }

    count.set(0);
    setHasStarted(true);
    const frame = window.requestAnimationFrame(() => count.set(value));
    return () => window.cancelAnimationFrame(frame);
  }, [count, isInView, loading, shouldReduceMotion, value]);

  if (loading) {
    return <strong ref={ref}>—</strong>;
  }

  if (hasStarted && !shouldReduceMotion) {
    return <motion.strong ref={ref}>{rounded}</motion.strong>;
  }

  return <strong ref={ref}>{value.toLocaleString()}</strong>;
}
