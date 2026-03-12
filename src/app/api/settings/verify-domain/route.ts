import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasFeature, featureGatedResponse } from "@/lib/feature-gate";
import dns from "dns/promises";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasFeature(session.user.tenantId, "custom_domain"))) {
      return NextResponse.json(featureGatedResponse("Custom domain"), { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { customDomain: true, customDomainVerified: true },
    });

    if (!tenant?.customDomain) {
      return NextResponse.json({ success: false, error: "No custom domain configured" }, { status: 400 });
    }

    if (tenant.customDomainVerified) {
      return NextResponse.json({ success: true, data: { verified: true, domain: tenant.customDomain } });
    }

    try {
      // Check if the domain resolves (CNAME or A record)
      const addresses = await dns.resolve4(tenant.customDomain).catch(() => []);
      const cnames = await dns.resolveCname(tenant.customDomain).catch(() => []);

      const hasRecords = addresses.length > 0 || cnames.length > 0;

      if (hasRecords) {
        await prisma.tenant.update({
          where: { id: session.user.tenantId },
          data: { customDomainVerified: true },
        });
        return NextResponse.json({
          success: true,
          data: { verified: true, domain: tenant.customDomain },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          verified: false,
          domain: tenant.customDomain,
          message: "DNS record not found. Please add the CNAME record and try again. DNS changes can take up to 48 hours to propagate.",
        },
      });
    } catch {
      return NextResponse.json({
        success: true,
        data: {
          verified: false,
          domain: tenant.customDomain,
          message: "Could not verify DNS. Please check your domain configuration and try again.",
        },
      });
    }
  } catch (error) {
    console.error("Domain verification error:", error);
    return NextResponse.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}
