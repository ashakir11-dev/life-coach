export function FactOrigin({
  amountLabel,
  originLabel,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  amountLabel: string;
  originLabel: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="fact-origin">
      <p>
        <span className="fact-origin-amount">{amountLabel}</span>
        <span> · {originLabel}</span>
      </p>
      {actionLabel && onAction ? (
        <div className="button-row">
          <button type="button" className="button button-secondary" onClick={onAction}>
            {actionLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button type="button" className="button button-secondary" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
