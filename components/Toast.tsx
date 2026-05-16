'use client';

interface Props {
  title: string;
  msg: string;
  type?: string;
}

export default function Toast({ title, msg, type = 'success' }: Props) {
  const icon = type === 'danger' ? '⚠️' : type === 'warning' ? '⚠️' : '✓';

  return (
    <div className={`toast ${type}`}>
      <div className="toast-icon">{icon}</div>
      <div>
        <div className="toast-title">{title}</div>
        {msg && <div className="toast-msg">{msg}</div>}
      </div>
    </div>
  );
}
