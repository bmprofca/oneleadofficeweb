import React from 'react';
import { FiCheck, FiSlash, FiX } from 'react-icons/fi';
import ActionMenu from '../ActionMenu';
import { OPEN_STAGES, STAGES } from '../../utils/crm';

const STEP_KEYS = [...OPEN_STAGES, 'won', 'lost'];
const STEPS = STEP_KEYS.map((key) => STAGES.find((s) => s.key === key));

/** Horizontal pipeline stepper. Clicking a step asks the parent to move the lead. */
export default function StageStepper({ status, onSelect, disabled = false }) {
  const currentIndex = OPEN_STAGES.indexOf(status);
  const isWon = status === 'won';
  const isClosedLost = status === 'lost' || status === 'not_interested';

  const stepState = (key, index) => {
    if (key === status) return 'current';
    if (key === 'won' || key === 'lost') return 'closed-option';
    if (isWon) return 'done';
    if (isClosedLost) return 'inactive';
    return index < currentIndex ? 'done' : 'upcoming';
  };

  return (
    <div className="ld-stepper-wrap">
      <ol className="ld-stepper" aria-label="Pipeline stage">
        {STEPS.map((stage, index) => {
          const state = stepState(stage.key, index);
          const terminal = stage.key === 'won' || stage.key === 'lost';
          return (
            <li key={stage.key} className={`ld-step ld-step-${state} ${terminal ? `ld-step-${stage.key}` : ''}`}>
              <button
                type="button"
                disabled={disabled || stage.key === status}
                onClick={() => onSelect(stage.key)}
                aria-current={stage.key === status ? 'step' : undefined}
                title={
                  stage.key === status
                    ? `Current stage: ${stage.label}`
                    : `Move to ${stage.label}${stage.probability ? ` (${stage.probability}% probability)` : ''}`
                }
              >
                <span className="ld-step-marker" aria-hidden="true">
                  {stage.key === 'won' ? (
                    <FiCheck size={12} />
                  ) : stage.key === 'lost' ? (
                    <FiX size={12} />
                  ) : state === 'done' ? (
                    <FiCheck size={12} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="ld-step-label">{stage.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="ld-stepper-more">
        {status === 'not_interested' ? (
          <span className="status status-not_interested">Not interested</span>
        ) : null}
        {!disabled && status !== 'not_interested' ? (
          <ActionMenu
            items={[
              {
                label: 'Mark not interested',
                icon: <FiSlash size={14} />,
                onClick: () => onSelect('not_interested'),
              },
            ]}
          />
        ) : null}
      </div>
    </div>
  );
}
