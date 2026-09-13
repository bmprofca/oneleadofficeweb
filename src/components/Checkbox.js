import React from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiMinus } from 'react-icons/fi';

export default function Checkbox({
  checked = false,
  indeterminate = false,
  onChange,
  ariaLabel,
}) {
  const active = checked || indeterminate;

  const handleClick = () => {
    if (indeterminate) {
      onChange?.(true);
      return;
    }
    onChange?.(!checked);
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      className={`ui-checkbox ${active ? 'checked' : ''} ${
        indeterminate ? 'indeterminate' : ''
      }`}
      onClick={handleClick}
    >
      <motion.span
        className="ui-checkbox-box"
        animate={{
          scale: active ? 1 : 0.96,
          backgroundColor: active ? 'var(--brand)' : 'transparent',
          borderColor: active ? 'var(--brand)' : 'var(--line)',
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      >
        <motion.span
          initial={false}
          animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.4 }}
          transition={{ duration: 0.15 }}
        >
          {indeterminate ? (
            <FiMinus size={12} color="#fff" strokeWidth={3} />
          ) : (
            <FiCheck size={12} color="#fff" strokeWidth={3} />
          )}
        </motion.span>
      </motion.span>
    </button>
  );
}
