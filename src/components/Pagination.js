import React, { useState } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
} from 'react-icons/fi';
import SearchableSelect from './SearchableSelect';

const LIMITS = [5, 10, 20, 50, 100].map((n) => ({
  value: String(n),
  label: String(n),
}));

export default function Pagination({
  page = 1,
  totalPages = 1,
  total = 0,
  limit = 20,
  onPageChange,
  onLimitChange,
}) {
  const [jump, setJump] = useState('');

  const go = (next) => {
    const safe = Math.min(Math.max(1, next), Math.max(1, totalPages));
    if (safe !== page) onPageChange?.(safe);
  };

  const handleJump = (e) => {
    e.preventDefault();
    const value = Number(jump);
    if (!value) return;
    go(value);
    setJump('');
  };

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <div className="pagination-left">
        <label className="pagination-limit">
          Rows
          <SearchableSelect
            value={String(limit)}
            options={LIMITS}
            clearable={false}
            onChange={(val) => onLimitChange?.(Number(val))}
          />
        </label>
        <span className="pagination-meta">
          {start}-{end} of {total}
        </span>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="icon-btn"
          disabled={page <= 1}
          onClick={() => go(1)}
          title="First page"
        >
          <FiChevronsLeft size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          title="Previous"
        >
          <FiChevronLeft size={15} />
        </button>
        <span className="pagination-page">
          Page {page} / {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          className="icon-btn"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
          title="Next"
        >
          <FiChevronRight size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={page >= totalPages}
          onClick={() => go(totalPages)}
          title="Last page"
        >
          <FiChevronsRight size={15} />
        </button>
      </div>

      <form className="pagination-jump" onSubmit={handleJump}>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          placeholder="Page #"
        />
        <button type="submit" className="btn small">
          Go
        </button>
      </form>
    </div>
  );
}
