import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiX } from 'react-icons/fi';

export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
}) {
  useEffect(() => {
    if (!open) return undefined;

    const scrollY = window.scrollY;
    const main = document.querySelector('.main');
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyWidth = document.body.style.width;
    const prevMainOverflow = main?.style.overflow || '';

    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    if (main) main.style.overflow = 'hidden';

    const blockBackdropScroll = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const body = target.closest('.modal-body, .ss-list, .dtp-time-col, .action-menu-dropdown');
      if (body) return;
      if (target.closest('.modal-card')) {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', blockBackdropScroll, { passive: false });
    document.addEventListener('touchmove', blockBackdropScroll, { passive: false });

    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.width = prevBodyWidth;
      if (main) main.style.overflow = prevMainOverflow;
      window.scrollTo(0, scrollY);
      document.removeEventListener('wheel', blockBackdropScroll);
      document.removeEventListener('touchmove', blockBackdropScroll);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onWheel={(e) => {
            if (!e.target.closest?.('.modal-body')) e.preventDefault();
          }}
        >
          <motion.div
            className={`modal-card modal-${size}`}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{title}</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={onClose}
                aria-label="Close"
              >
                <FiX size={16} />
              </button>
            </div>
            <div className="modal-body hide-scrollbar">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
