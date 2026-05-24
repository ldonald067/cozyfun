export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  title?: string;
  disabled?: boolean;
  badge?: string;
  testId?: string;
};

type SegmentedControlProps<T extends string> = {
  ariaLabel: string;
  value: T;
  options: SegmentOption<T>[];
  className?: string;
  onChange(value: T): void;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  options,
  className = "",
  onChange
}: SegmentedControlProps<T>) {
  return (
    <div className={`segmented-control ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "active" : ""}
          data-testid={option.testId}
          title={option.title}
          aria-label={option.badge ? `${option.label} (${option.badge})` : option.label}
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
          {option.badge ? <small aria-hidden="true">{option.badge}</small> : null}
        </button>
      ))}
    </div>
  );
}
