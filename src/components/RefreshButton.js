import React, { useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';

export default function RefreshButton({ onRefresh, label = 'Refresh' }) {
  const [spinning, setSpinning] = useState(false);

  const handleClick = async () => {
    if (spinning || !onRefresh) return;
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      // Keep a short spin so the action feels responsive
      setTimeout(() => setSpinning(false), 400);
    }
  };

  return (
    <button
      type="button"
      className="btn refresh-btn"
      onClick={handleClick}
      disabled={spinning}
      title={label}
      aria-label={label}
    >
      <FiRefreshCw size={15} className={spinning ? 'spin' : ''} />
      <span>{label}</span>
    </button>
  );
}
