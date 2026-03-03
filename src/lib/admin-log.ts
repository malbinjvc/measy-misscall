import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface LogAdminActionParams {
  action: string;
  details: string;
  tenantId?: string;
  tenantName?: string;
  userId?: string;
  userName?: string;
  status?: "SUCCESS" | "FAILED";
  metadata?: Prisma.InputJsonValue;
}

export async function logAdminAction(params: LogAdminActionParams) {
  try {
    await prisma.adminLog.create({
      data: {
        action: params.action,
        details: params.details,
        tenantId: params.tenantId,
        tenantName: params.tenantName,
        userId: params.userId,
        userName: params.userName,
        status: params.status ?? "SUCCESS",
        metadata: params.metadata ?? undefined,
      },
    });
  } catch (error) {
    // Never block the main operation if logging fails
    console.error("Failed to write admin log:", error);
  }
}
