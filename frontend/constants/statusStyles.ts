/**
 * Shared Status Pill Styles
 * Single source of truth for status colors across Customer and Provider screens
 * DO NOT modify - Customer My Requests is the design source of truth
 */

export interface StatusStyle {
  label: string;
  bgColor: string;
  textColor: string;
}

// Exact hex values for each status (Customer is source of truth)
export const STATUS_COLORS = {
  // Pending - Blue
  pending: {
    bg: '#EAF3FF',
    text: '#4A7DC4',
  },
  // Accepted - Green
  accepted: {
    bg: '#E8F5E9',
    text: '#2E7D32',
  },
  // Awaiting Payment - Yellow/Amber
  awaiting_payment: {
    bg: '#FFF3E0',
    text: '#E65100',
  },
  // Ready to Start - Blue (same as In Progress - payment confirmed, waiting for job start)
  ready_to_start: {
    bg: '#E3F2FD',
    text: '#1565C0',
  },
  // In Progress - Blue (slightly different shade)
  in_progress: {
    bg: '#EEF6FF',
    text: '#2C5AA0',
  },
  // Completed variants - Purple
  completed: {
    bg: '#F3E5F5',
    text: '#7B1FA2',
  },
  completed_pending_review: {
    bg: '#F3E5F5',  // Same as completed
    text: '#7B1FA2',
  },
  completed_reviewed: {
    bg: '#F3E5F5',  // Same as completed
    text: '#7B1FA2',
  },
  // Cancelled - Yellow/Amber (same as awaiting payment)
  cancelled: {
    bg: '#FFF3E0',
    text: '#E65100',
  },
  // Declined - Red
  declined: {
    bg: '#FFEBEE',
    text: '#C62828',
  },
  // Default fallback - Light gray
  default: {
    bg: '#F5F5F5',
    text: '#666666',
  },
};

// Status labels (shared)
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  awaiting_payment: 'Awaiting Payment',
  ready_to_start: 'Ready to Start',
  in_progress: 'In Progress',
  completed: 'Completed',
  completed_pending_review: 'Completed',  // Show as "Completed" (not "Pending Review")
  completed_reviewed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
};

/**
 * Get status style for a given status string
 * Handles all variants including provider-specific ones
 */
export function getStatusStyle(status: string): StatusStyle {
  const normalizedStatus = status?.toLowerCase() || '';
  
  // Handle completed variants
  if (normalizedStatus.startsWith('completed')) {
    return {
      label: 'Completed',
      bgColor: STATUS_COLORS.completed.bg,
      textColor: STATUS_COLORS.completed.text,
    };
  }
  
  // Handle awaiting payment variants
  if (normalizedStatus.includes('awaiting') || normalizedStatus.includes('payment')) {
    return {
      label: 'Awaiting Payment',
      bgColor: STATUS_COLORS.awaiting_payment.bg,
      textColor: STATUS_COLORS.awaiting_payment.text,
    };
  }
  
  // Handle cancel/cancelled variants
  if (normalizedStatus.includes('cancel')) {
    return {
      label: 'Cancelled',
      bgColor: STATUS_COLORS.cancelled.bg,
      textColor: STATUS_COLORS.cancelled.text,
    };
  }
  
  // Direct match
  const colors = STATUS_COLORS[normalizedStatus as keyof typeof STATUS_COLORS];
  if (colors) {
    return {
      label: STATUS_LABELS[normalizedStatus] || formatStatusLabel(normalizedStatus),
      bgColor: colors.bg,
      textColor: colors.text,
    };
  }
  
  // Fallback
  return {
    label: formatStatusLabel(status),
    bgColor: STATUS_COLORS.default.bg,
    textColor: STATUS_COLORS.default.text,
  };
}

/**
 * Format a status string into a human-readable label
 */
function formatStatusLabel(status: string): string {
  if (!status) return 'Unknown';
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get effective display status considering payment status
 * When paymentStatus is 'held' but status is still 'awaiting_payment',
 * we should show "Ready to Start" not "Awaiting Payment"
 * 
 * SINGLE SOURCE OF TRUTH - Import this everywhere status is displayed
 */
export function getEffectiveStatus(request: { status: string; paymentStatus?: string }): string {
  if (request.status === 'awaiting_payment' && request.paymentStatus === 'held') {
    return 'ready_to_start';
  }
  return request.status;
}

/**
 * Legacy-compatible getStatusColor function for Customer My Requests
 * Returns { bg, text } format
 */
export function getStatusColor(status: string): { bg: string; text: string } {
  const style = getStatusStyle(status);
  return {
    bg: style.bgColor,
    text: style.textColor,
  };
}

/**
 * Legacy-compatible getStatusBadge function for Provider Dashboard
 * Returns { label, color, bgColor } format
 */
export function getStatusBadge(status: string): { label: string; color: string; bgColor: string } {
  const style = getStatusStyle(status);
  return {
    label: style.label,
    color: style.textColor,
    bgColor: style.bgColor,
  };
}
