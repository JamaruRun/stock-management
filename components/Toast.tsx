'use client';

interface Props {
  title: string;
  msg: string;
  type: string;
}

export default function Toast({ title, msg, type }: Props) {
  return (
    <div className={`toast ${type}`}>
      <div className="toast-title">{title}</div>
      {msg && <div className="toast-msg">{msg}</div>}
    </div>
  );
}
