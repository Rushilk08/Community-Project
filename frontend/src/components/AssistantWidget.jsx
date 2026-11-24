import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { askWorkLinkAssistant } from '../services/api';

export default function AssistantWidget() {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [messages, setMessages] = useState([]);
  const inputRef = useRef(null);
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
      block: 'nearest'
    });
  }, [messages, isWaiting, shouldReduceMotion]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || isWaiting) return;

    setQuestion('');
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setIsWaiting(true);
    try {
      const result = await askWorkLinkAssistant(text);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: result.answer, sources: result.sources || [] }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: error.message || t('assistantUnavailable'), sources: [] }
      ]);
    } finally {
      setIsWaiting(false);
    }
  };

  return (
    <div className="assistant-widget">
      {isOpen && (
        <motion.aside
          className="assistant-panel"
          aria-label={t('assistantTitle')}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
        >
          <div className="assistant-header">
            <div>
              <strong>{t('assistantTitle')}</strong>
              <span>{t('assistantScope')}</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label={t('closeAssistant')}>
              ×
            </button>
          </div>

          <div className="assistant-messages" aria-live="polite">
            {messages.length === 0 && (
              <p className="assistant-welcome">{t('assistantWelcome')}</p>
            )}
            {messages.map((message, index) => (
              <div
                className={`assistant-message ${message.role}`}
                key={`${message.role}-${index}`}
              >
                <p>{message.content}</p>
                {message.sources?.length > 0 && (
                  <div className="assistant-sources">
                    <span>{t('assistantSources')}</span>
                    {message.sources.map((source) => (
                      <Link key={source.id} to={source.path} onClick={() => setIsOpen(false)}>
                        {source.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isWaiting && <p className="assistant-waiting">{t('assistantThinking')}</p>}
            <div ref={endOfMessagesRef} />
          </div>

          <form className="assistant-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="worklink-assistant-question">{t('assistantInput')}</label>
            <input
              id="worklink-assistant-question"
              ref={inputRef}
              type="text"
              maxLength={700}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={t('assistantInput')}
              disabled={isWaiting}
            />
            <button type="submit" disabled={isWaiting || !question.trim()}>
              {t('assistantSend')}
            </button>
          </form>
        </motion.aside>
      )}

      <motion.button
        type="button"
        className="assistant-toggle"
        aria-expanded={isOpen}
        aria-label={isOpen ? t('closeAssistant') : t('openAssistant')}
        onClick={() => setIsOpen((open) => !open)}
        whileHover={shouldReduceMotion ? undefined : { y: -2 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 24 }}
      >
        {isOpen ? '×' : t('assistantButton')}
      </motion.button>
    </div>
  );
}
