import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';

const services = [
  ['Construction Workers', 'Masons, carpenters and skilled building professionals.', 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=85'],
  ['Painting Services', 'Experienced painters for homes, offices and projects.', 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=85'],
  ['Plumbing & Electrical', 'Reliable technicians for repairs and installations.', 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=85'],
  ['Cleaning & General Labour', 'Dependable hands for everyday and on-demand work.', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=85']
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="public-site">
      <header className="public-nav">
        <Link to="/" className="public-brand"><span className="brand-mark">WS</span><span>WorkSetu</span></Link>
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">☰</button>
        <nav className={menuOpen ? 'public-links open' : 'public-links'}>
          <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a>
          <a href="#services" onClick={() => setMenuOpen(false)}>Services</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About Us</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
        </nav>
        <div className="public-actions">
          <LanguageSwitcher />
          <Link to="/customer/login" className="nav-login">Customer Login</Link>
          <Link to="/worker/login" className="nav-worker">Worker Login</Link>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-shape hero-shape-one" />
          <div className="hero-shape hero-shape-two" />
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="eyebrow">Trusted local hiring</span>
              <h1>Find the Right Workers.<br /><em>Get Work Done Faster.</em></h1>
              <p>WorkSetu connects customers and contractors with skilled and reliable workers nearby. Post a clear job request and start work quickly.</p>
              <div className="hero-buttons">
                <Link to="/customer/login" className="button button-primary">Hire Workers <span>→</span></Link>
                <Link to="/worker/login" className="button button-light">Find Work <span>→</span></Link>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-wrap">
          <div className="feature-grid">
            <article className="feature-card"><span className="feature-number">01</span><div><h3>Hire Workers</h3><p>Find nearby workers based on skill and availability.</p></div></article>
            <article className="feature-card"><span className="feature-number">02</span><div><h3>Find Daily Work</h3><p>Receive job opportunities directly on your dashboard.</p></div></article>
            <article className="feature-card"><span className="feature-number">03</span><div><h3>Fast &amp; Reliable</h3><p>Connect through a simple, transparent booking process.</p></div></article>
          </div>
        </section>

        <section className="about-section" id="about">
          <div className="about-image">
            <img src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1100&q=85" alt="Construction professionals at a building site" />
            <div className="experience-badge"><strong>10+</strong><span>Local trades</span></div>
          </div>
          <div className="about-copy">
            <span className="section-label">About WorkSetu</span>
            <h2>A Smarter Way to Connect Workers and Customers</h2>
            <p>WorkSetu simplifies daily-wage hiring. Customers can post clear requirements and hire nearby talent quickly, while workers control their availability and discover local opportunities.</p>
            <div className="about-points"><span><b>✓</b> Verified job details</span><span><b>✓</b> Nearby worker matching</span></div>
            <Link to="/customer/register" className="button button-primary">Get Started <span>→</span></Link>
          </div>
        </section>

        <section className="services-section" id="services">
          <div className="section-heading">
            <div><span className="section-label light">Our Services</span><h2>Explore WorkSetu Services</h2></div>
            <p>Choose the right trade and find dependable professionals for your next project.</p>
          </div>
          <div className="service-grid">
            {services.map(([title, text, image], index) => (
              <article className="service-card" key={title}>
                <img src={image} alt={title} />
                <div className="service-overlay" />
                <div className="service-content"><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="process-section" id="how-it-works">
          <span className="section-label">How It Works</span>
          <h2>Simple for Everyone</h2>
          <div className="process-grid">
            <div className="process-panel">
              <h3>👷 For Workers</h3>
              {['Register and complete your profile', 'Set your skills and availability', 'Receive nearby job offers', 'Accept work and navigate to the site'].map((step, i) => (
                <div className="process-step" key={step}><b>{i + 1}</b><p>{step}</p></div>
              ))}
            </div>
            <div className="process-panel customer-process">
              <h3>🏗️ For Customers</h3>
              {['Register or log in', 'Post a job with clear requirements', 'Receive worker responses', 'Confirm workers and track progress'].map((step, i) => (
                <div className="process-step" key={step}><b>{i + 1}</b><p>{step}</p></div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="public-footer" id="contact">
        <div className="footer-brand"><Link to="/" className="public-brand"><span className="brand-mark">WS</span><span>WorkSetu</span></Link><p>Connecting reliable local workers with everyday work opportunities.</p></div>
        <div><h4>Platform</h4><Link to="/customer/login">Customer Login</Link><Link to="/worker/login">Worker Login</Link><a href="#how-it-works">How It Works</a></div>
        <div><h4>Company</h4><a href="#about">About Us</a><a href="#services">Services</a><a href="#contact">Privacy Policy</a></div>
        <div><h4>Contact</h4><a href="mailto:hello@worksetu.in">hello@worksetu.in</a><a href="tel:+919876543210">+91 98765 43210</a><span>Bengaluru, Karnataka</span></div>
        <div className="footer-bottom">© {new Date().getFullYear()} WorkSetu. All rights reserved.</div>
      </footer>
    </div>
  );
}
