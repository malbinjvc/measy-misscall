import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "majorella"> = {
  // Call statuses
  MISSED: "destructive",
  ANSWERED: "success",
  FAILED: "destructive",
  BUSY: "warning",
  NO_ANSWER: "warning",
  // Appointment statuses
  PENDING: "success",
  CONFIRMED: "default",
  COMPLETED: "majorella",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
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
  CANCELING: "warning",
  UNPAID: "destructive",
  INCOMPLETE: "warning",
  // IVR responses
  CALLBACK: "destructive",
  BOOKING_LINK: "default",
  COMPLAINT: "warning",
  NO_RESPONSE: "secondary",
  INVALID: "destructive",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusLabels: Record<string, string> = {
  PENDING: "PROCESSING",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusColors[status] || "secondary";
  const label = (statusLabels[status] || status).replace(/_/g, " ");

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
