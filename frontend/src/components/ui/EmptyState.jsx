export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="ui-empty-state">
      {icon && <div className="ui-empty-state-icon">{icon}</div>}
      {title && <p className="ui-empty-state-title">{title}</p>}
      {description && <p className="ui-empty-state-desc">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="ui-empty-state-btn">
          {action.label}
        </button>
      )}
    </div>
  );
}
