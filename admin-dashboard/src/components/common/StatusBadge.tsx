interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase()
  let className = 'badge badge-info'

  if (normalized.includes('healthy')) {
    className = 'badge badge-success'
  } else if (normalized.includes('stable')) {
    className = 'badge badge-info'
  } else if (normalized.includes('watch') || normalized.includes('warning') || normalized.includes('low')) {
    className = 'badge badge-warning'
  } else if (normalized.includes('critical') || normalized.includes('danger')) {
    className = 'badge badge-danger'
  }

  return <span className={className}>{status}</span>
}
