import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  // Call statuses
  MISSED: "destructive",
  ANSWERED: "success",
  FAILED: "destructive",
  BUSY: "warning",
  NO_ANSWER: "warning",
  // Appointment statuses
  PENDING: "warning",
  CONFIRMED: "default",
  COMPLETED: "success",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
  // Complaint statuses
  OPEN: "warning",
  IN_PROGRESS: "default",
  RESOLVED: "success",
  CLOSED: "secondary",
  // SMS statuses
  QUEUED: "secondary",
  SENT: "default",
  DELIVERED: "success",
  UNDELIVERED: "destructive",
  // Tenant statuses
  ONBOARDING: "warning",
  ACTIVE: "success",
  SUSPENDED: "destructive",
  DISABLED: "destructive",
  // Subscription statuses
  TRIALING: "warning",
  PAST_DUE: "destructive",
  CANCELED: "destructive",
  UNPAID: "destructive",
  INCOMPLETE: "warning",
  // IVR responses
  CALLBACK: "default",
  COMPLAINT: "warning",
  NO_RESPONSE: "secondary",
  INVALID: "destructive",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusColors[status] || "secondary";
  const label = status.replace(/_/g, " ");

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
