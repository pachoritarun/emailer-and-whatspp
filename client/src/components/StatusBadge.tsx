import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const norm = (status || '').toUpperCase();

  let badgeClass = 'badge-draft';
  let label = status;

  if (['DELIVERED', 'APPROVED', 'HEALTHY', 'COMPLETED', 'PROCESSED', 'ONLINE', 'OPTED_IN'].includes(norm)) {
    badgeClass = 'badge-delivered';
  } else if (['PENDING', 'WARNING', 'SCHEDULED', 'LOCKED'].includes(norm)) {
    badgeClass = 'badge-pending';
  } else if (['FAILED', 'CRITICAL', 'DEAD_LETTER', 'REJECTED', 'OPTED_OUT', 'REVOKED'].includes(norm)) {
    badgeClass = 'badge-failed';
  } else if (['PROCESSING', 'QUEUED', 'SUBMITTED', 'SUBMITTED_TO_PROVIDER', 'ACCEPTED', 'SENT', 'RETRYING'].includes(norm)) {
    badgeClass = 'badge-processing';
  } else if (['DRAFT', 'SKIPPED', 'CANCELLED', 'SUPPRESSED'].includes(norm)) {
    badgeClass = 'badge-draft';
  }

  return (
    <span className={`badge ${badgeClass}`}>
      <span style={{
        width: '5px',
        height: '5px',
        borderRadius: '50%',
        backgroundColor: 'currentColor'
      }}></span>
      {label}
    </span>
  );
};
