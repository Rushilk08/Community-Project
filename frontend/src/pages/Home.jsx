import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import LanguageSwitcher from '../components/LanguageSwitcher';
import useHomeScrollAnimations from '../hooks/useHomeScrollAnimations';

const MotionLink = motion.create(Link);

export default function Home() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);
  useHomeScrollAnimations(rootRef);

  const handleServiceTilt = (event) => {
    if (event.pointerType === 'touch') return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty('--tilt-x', `${horizontal * 3}deg`);
    event.currentTarget.style.setProperty('--tilt-y', `${vertical * -3}deg`);
  };

  const resetServiceTilt = (event) => {
    event.currentTarget.style.setProperty('--tilt-x', '0deg');
    event.currentTarget.style.setProperty('--tilt-y', '0deg');
  };

  const services = [
    {
      title: t('service1Title'),
      text: t('service1Desc'),
      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=85'
    },
    {
      title: t('service2Title'),
      text: t('service2Desc'),
      image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=85'
    },
    {
      title: t('service3Title'),
      text: t('service3Desc'),
      image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=85'
    },
    {
      title: t('service4Title'),
      text: t('service4Desc'),
      image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=85'
    }
  ];

  const workerSteps = [
    t('workerStep1'),
    t('workerStep2'),
    t('workerStep3'),
    t('workerStep4')
  ];

  const customerSteps = [
    t('customerStep1'),
    t('customerStep2'),
    t('customerStep3'),
    t('customerStep4')
  ];

  return (
    <div className="public-site" ref={rootRef}>
      <header className="public-nav">
        <Link to="/" className="public-brand">
          <span className="brand-mark">WL</span>
          <span>WorkLink</span>
        </Link>
        <button
          className="menu-toggle"
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation"
        >
          ☰
        </button>
        <nav className={menuOpen ? 'public-links open' : 'public-links'}>
          <a href="#home" onClick={() => setMenuOpen(false)}>{t('navHome')}</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>{t('navHowItWorks')}</a>
          <a href="#services" onClick={() => setMenuOpen(false)}>{t('navServices')}</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>{t('navAbout')}</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>{t('navContact')}</a>
        </nav>
        <div className="public-actions">
          <LanguageSwitcher />
          <Link to="/customer/login" className="nav-login">{t('customerLogin')}</Link>
          <Link to="/worker/login" className="nav-worker">{t('workerLogin')}</Link>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-image" aria-hidden="true" />
          <div className="hero-shape hero-shape-one" />
          <div className="hero-shape hero-shape-two" />
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="eyebrow" data-hero-reveal>{t('heroEyebrow')}</span>
              <h1 data-hero-reveal>
                <span aria-hidden="true">
                  {t('heroTitle').split(/\s+/).map((word, index) => (
                    <span className="hero-word-clip" key={`${word}-${index}`}>
                      <span className="hero-word">{word}</span>
                    </span>
                  ))}
                </span>
                <span className="sr-only">{t('heroTitle')}</span>
              </h1>
              <p data-hero-reveal>
                {t('heroSubtitle')}
              </p>
              <div className="hero-buttons" data-hero-reveal>
                <MotionLink
                  to="/customer/login"
                  className="button button-primary"
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                >
                  {t('hireWorkers')} <span>→</span>
                </MotionLink>
                <MotionLink
                  to="/worker/login"
                  className="button button-light"
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                >
                  {t('findWork')} <span>→</span>
                </MotionLink>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-wrap">
          <div className="feature-grid" data-scroll-reveal>
            <article className="feature-card" data-stagger-card>
              <span className="feature-number">01</span>
              <div>
                <h3>{t('feature1Title')}</h3>
                <p>{t('feature1Desc')}</p>
              </div>
            </article>
            <article className="feature-card" data-stagger-card>
              <span className="feature-number">02</span>
              <div>
                <h3>{t('feature2Title')}</h3>
                <p>{t('feature2Desc')}</p>
              </div>
            </article>
            <article className="feature-card" data-stagger-card>
              <span className="feature-number">03</span>
              <div>
                <h3>{t('feature3Title')}</h3>
                <p>{t('feature3Desc')}</p>
              </div>
            </article>
          </div>
        </section>

        <section className="about-section" id="about" data-scroll-reveal>
          <div className="about-image">
            <img
              data-parallax="5"
              src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1100&q=85"
              alt="Construction professionals at a building site"
            />
            <div className="experience-badge">
              <strong>10+</strong>
              <span>Local trades</span>
            </div>
          </div>
          <div className="about-copy">
            <span className="section-label">{t('aboutTitle')}</span>
            <h2>{t('aboutHeading')}</h2>
            <p>{t('aboutText')}</p>
            <div className="about-points">
              <span><b>✓</b> {t('aboutPoint1')}</span>
              <span><b>✓</b> {t('aboutPoint2')}</span>
            </div>
            <Link to="/customer/register" className="button button-primary">
              {t('getStarted')} <span>→</span>
            </Link>
          </div>
        </section>

        <section className="services-section" id="services">
          <div className="section-heading" data-scroll-reveal>
            <div>
              <span className="section-label light">{t('servicesTitle')}</span>
              <h2>{t('servicesHeading')}</h2>
            </div>
            <p>{t('servicesSub')}</p>
          </div>
          <div className="service-grid" data-scroll-reveal>
            {services.map((svc, index) => (
              <motion.article
                className="service-card"
                key={svc.title}
                onPointerMove={handleServiceTilt}
                onPointerLeave={resetServiceTilt}
              >
                <img src={svc.image} alt={svc.title} />
                <div className="service-overlay" />
                <div className="service-content">
                  <span>0{index + 1}</span>
                  <h3>{svc.title}</h3>
                  <p>{svc.text}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="process-section" id="how-it-works">
          <div className="process-heading" data-scroll-reveal>
            <span className="section-label">{t('navHowItWorks')}</span>
            <h2>{t('howItWorksHeading')}</h2>
          </div>
          <div className="process-grid">
            <div className="process-panel">
              <h3>👷 {t('forWorkers')}</h3>
              {workerSteps.map((step, i) => (
                <div className="process-step" data-process-step key={step}>
                  <b>{i + 1}</b>
                  <p>{step}</p>
                </div>
              ))}
            </div>
            <div className="process-panel customer-process">
              <h3>🏗️ {t('forCustomers')}</h3>
              {customerSteps.map((step, i) => (
                <div className="process-step" data-process-step key={step}>
                  <b>{i + 1}</b>
                  <p>{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta" id="contact-cta" aria-labelledby="final-cta-heading">
          <div className="final-cta-orbit final-cta-orbit-one" data-parallax="-8" aria-hidden="true" />
          <div className="final-cta-orbit final-cta-orbit-two" data-parallax="6" aria-hidden="true" />
          <div className="final-cta-content">
            <span className="section-label light" data-final-cta-item>{t('navContact')}</span>
            <h2 id="final-cta-heading" data-final-cta-item>{t('finalCtaHeading')}</h2>
            <p data-final-cta-item>{t('finalCtaText')}</p>
            <div className="final-cta-actions" data-final-cta-item>
              <MotionLink
                to="/customer/register"
                className="button button-primary"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24 }}
              >
                {t('hireWorkers')} <span>→</span>
              </MotionLink>
              <MotionLink
                to="/worker/register"
                className="button button-light"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24 }}
              >
                {t('findWork')} <span>→</span>
              </MotionLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="public-footer" id="contact">
        <div className="footer-brand">
          <Link to="/" className="public-brand">
            <span className="brand-mark">WL</span>
            <span>WorkLink</span>
          </Link>
          <p>{t('footerTagline')}</p>
        </div>
        <div>
          <h4>Platform</h4>
          <Link to="/customer/login">{t('customerLogin')}</Link>
          <Link to="/worker/login">{t('workerLogin')}</Link>
          <a href="#how-it-works">{t('navHowItWorks')}</a>
        </div>
        <div>
          <h4>Company</h4>
          <a href="#about">{t('navAbout')}</a>
          <a href="#services">{t('navServices')}</a>
          <a href="#contact">Privacy Policy</a>
        </div>
        <div>
          <h4>Contact</h4>
          <a href="mailto:hello@worklink.in">hello@worklink.in</a>
          <a href="tel:+919876543210">+91 98765 43210</a>
          <span>Bengaluru, Karnataka</span>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} WorkLink. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
