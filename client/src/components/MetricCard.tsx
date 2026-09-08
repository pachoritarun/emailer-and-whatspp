import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtext, icon }) => {
  return (
    <div className="metric-card">
      <div className="metric-card-header">
        <span className="metric-card-title">{title}</span>
        {icon ? (
          <span style={{ color: 'var(--uni-red)', display: 'flex', alignItems: 'center' }}>
            {icon}
          </span>
        ) : (
          <span className="metric-accent-dot"></span>
        )}
      </div>
      <div className="metric-card-value">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {subtext && <div className="metric-card-subtext">{subtext}</div>}
    </div>
  );
};
