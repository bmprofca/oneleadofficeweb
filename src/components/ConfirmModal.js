import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

export default function ConfirmModal({
  open,
  title = 'Confirm delete',
  message = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="modal-card modal-sm confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="confirm-modal-title">{title}</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={onClose}
                disabled={loading}
                aria-label="Close"
              >
                <FiX size={16} />
              </button>
            </div>
            <div className="modal-body confirm-modal-body">
              <div className="confirm-icon" aria-hidden>
                <FiAlertTriangle size={22} />
              </div>
              <p className="confirm-message">{message}</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn"
                onClick={onClose}
                disabled={loading}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={onConfirm}
                disabled={loading}
              >
                {loading ? 'Deleting…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
