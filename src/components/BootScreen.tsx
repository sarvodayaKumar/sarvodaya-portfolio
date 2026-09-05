"use client";

type BootScreenProps = {
  progress?: number;
  indeterminate?: boolean;
};

export default function BootScreen({ progress = 12, indeterminate = false }: BootScreenProps) {
  const width = Math.max(8, Math.min(progress, 100));

  return (
    <div className="boot-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="boot-mark" aria-hidden="true">
        <span className="boot-ring" />
        <span className="boot-ring boot-ring-delay" />
        <span className="boot-initials">SK</span>
      </div>
      <p className="boot-name">Sarvodaya Kumar</p>
      <p className="boot-role">Cloud backend developer</p>
      <div className="boot-track-wrap">
        <div className="boot-meta">
          <span>Loading</span>
          <span>{indeterminate ? "" : `${width}%`}</span>
        </div>
        <div className={`boot-track${indeterminate ? " is-indeterminate" : ""}`}>
          <span style={indeterminate ? undefined : { transform: `scaleX(${width / 100})` }} />
        </div>
      </div>
    </div>
  );
}
