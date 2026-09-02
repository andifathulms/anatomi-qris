import './toggle.css';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A two-or-more item segmented control. Selection is a 2 px --ink outline;
 * there is no selection blue anywhere in this app (DESIGN.md §2.4).
 */
export function Toggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="toggle" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="toggle__button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
