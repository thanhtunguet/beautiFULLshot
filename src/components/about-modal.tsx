// AboutModal - Custom About dialog with full app information
// Shows app icon, version, author, website, and social links

import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const APP_INFO = {
  name: 'beautiFULLshot',
  version: '1.0.3',
  description: 'Capture, annotate, and beautify screenshots',
  copyright: '© 2025 itsddvn',
  website: 'https://beautifullshot.itsdd.vn',
  github: 'https://github.com/itsddvn/beautiFULLshot',
  author: {
    name: 'itsddvn',
    github: 'https://github.com/itsddvn',
    youtube: 'https://youtube.com/@itsddvn',
    facebook: 'https://facebook.com/itsddvn',
  },
};

export function AboutModal({ isOpen, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className="glass-heavy floating-panel w-[360px] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center">
          {/* App Icon */}
          <img
            src="/app-icon.png"
            alt="beautiFULLshot"
            className="w-20 h-20 mb-4 rounded-2xl shadow-lg"
          />

          {/* App Name */}
          <h2 id="about-title" className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {APP_INFO.name}
          </h2>

          {/* Version */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Version {APP_INFO.version}
          </p>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
            {APP_INFO.description}
          </p>

          {/* Copyright */}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {APP_INFO.copyright}
          </p>

          {/* Divider */}
          <div className="w-full border-t border-white/10 dark:border-white/5 my-4" />

          {/* Links */}
          <div className="flex flex-col gap-2 w-full">
            <a
              href={APP_INFO.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 glass-btn rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:text-orange-500 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              beautifullshot.itsdd.vn
            </a>

            <a
              href={APP_INFO.github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 glass-btn rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:text-orange-500 transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub
            </a>
          </div>

          {/* Social Links */}
          <div className="flex gap-3 mt-4">
            <a
              href={APP_INFO.author.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center glass-btn rounded-xl text-gray-500 dark:text-gray-400 hover:text-red-500 transition-all"
              title="YouTube"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </a>
            <a
              href={APP_INFO.author.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center glass-btn rounded-xl text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-all"
              title="Facebook"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <a
              href={APP_INFO.author.github}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center glass-btn rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-all"
              title="Author GitHub"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 dark:border-white/5 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 glass-btn glass-btn-active text-orange-500 rounded-xl text-sm font-medium transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
