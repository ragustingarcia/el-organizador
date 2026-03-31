// src/components/ProgressBar.tsx

type Props = {
  current: number;
  total: number;
  label?: string;
};

export default function ProgressBar({ current, total, label }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="progress-wrap">
      <div className="progress-bar">
        <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-text">
        {label ?? `Escaneando... ${current} / ${total}`}
      </p>
    </div>
  );
}
