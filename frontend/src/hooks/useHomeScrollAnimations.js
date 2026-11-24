import { useEffect } from 'react';

export default function useHomeScrollAnimations(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    let active = true;
    let context;
    let refreshFrame;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
      .then(([gsapModule, scrollTriggerModule]) => {
        if (!active) return;

        const gsap = gsapModule.default;
        const { ScrollTrigger } = scrollTriggerModule;
        gsap.registerPlugin(ScrollTrigger);

        context = gsap.context(() => {
          const hero = root.querySelector('.hero');
          const heroImage = root.querySelector('.hero-image');

          gsap.from(hero.querySelectorAll('[data-hero-reveal]'), {
            y: 28,
            autoAlpha: 0,
            duration: 0.9,
            stagger: 0.14,
            ease: 'power3.out',
            clearProps: 'all'
          });
          gsap.from(hero.querySelectorAll('.hero-word'), {
            yPercent: 110,
            autoAlpha: 0,
            duration: 0.9,
            stagger: 0.045,
            delay: 0.18,
            ease: 'power3.out',
            clearProps: 'all'
          });

          gsap.fromTo(heroImage, { scale: 1.12 }, { scale: 1, duration: 1.6, ease: 'power3.out' });
          gsap.to(heroImage, {
            yPercent: 7,
            ease: 'none',
            scrollTrigger: {
              trigger: hero,
              start: 'top top',
              end: 'bottom top',
              scrub: true
            }
          });
          gsap.to(hero.querySelectorAll('.hero-shape'), {
            yPercent: -14,
            ease: 'none',
            stagger: 0.08,
            scrollTrigger: {
              trigger: hero,
              start: 'top top',
              end: 'bottom top',
              scrub: true
            }
          });

          gsap.utils.toArray('[data-scroll-reveal]', root).forEach((element) => {
            gsap.fromTo(
              element,
              { y: 30, autoAlpha: 0 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.85,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: element,
                  start: 'top 84%',
                  once: true
                }
              }
            );
          });

          gsap.fromTo(
            root.querySelectorAll('[data-stagger-card]'),
            { y: 24, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.7,
              stagger: 0.12,
              ease: 'power3.out',
              clearProps: 'transform',
              scrollTrigger: {
                trigger: root.querySelector('.feature-grid'),
                start: 'top 88%',
                once: true
              }
            }
          );

          gsap.fromTo(
            root.querySelectorAll('.service-card'),
            { y: 30, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.75,
              stagger: 0.1,
              ease: 'power3.out',
              clearProps: 'transform',
              scrollTrigger: {
                trigger: root.querySelector('.service-grid'),
                start: 'top 86%',
                once: true
              }
            }
          );

          gsap.utils.toArray('[data-process-step]', root).forEach((step) => {
            gsap.fromTo(
              step,
              { x: -14, autoAlpha: 0 },
              {
                x: 0,
                autoAlpha: 1,
                duration: 0.55,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: step,
                  start: 'top 88%',
                  once: true,
                  onEnter: () => step.classList.add('is-active')
                }
              }
            );
          });

          const publicNav = root.querySelector('.public-nav');
          ScrollTrigger.create({
            trigger: root,
            start: 'top -12px',
            end: 'bottom top',
            onEnter: () => publicNav.classList.add('is-scrolled'),
            onLeaveBack: () => publicNav.classList.remove('is-scrolled'),
            onLeave: () => publicNav.classList.remove('is-scrolled')
          });

          gsap.utils.toArray('[data-parallax]', root).forEach((layer) => {
            gsap.to(layer, {
              yPercent: Number(layer.dataset.parallax),
              ease: 'none',
              scrollTrigger: {
                trigger: layer.parentElement,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true
              }
            });
          });

          const finalCta = root.querySelector('.final-cta');
          gsap.fromTo(
            finalCta.querySelectorAll('[data-final-cta-item]'),
            { y: 22, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.72,
              stagger: 0.13,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: finalCta,
                start: 'top 82%',
                once: true
              }
            }
          );

          const footer = root.querySelector('.public-footer');
          gsap.fromTo(
            footer.querySelectorAll(':scope > div'),
            { y: 20, autoAlpha: 0 },
            {
              y: 0,
              autoAlpha: 1,
              duration: 0.65,
              stagger: 0.08,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: footer,
                start: 'top 88%',
                once: true
              }
            }
          );
        }, root);

        refreshFrame = window.requestAnimationFrame(() => ScrollTrigger.refresh());
      })
      .catch((error) => {
        context?.revert();
        console.error('WorkLink scroll animations could not be initialized.', error);
      });

    return () => {
      active = false;
      if (refreshFrame) window.cancelAnimationFrame(refreshFrame);
      context?.revert();
    };
  }, [rootRef]);
}
