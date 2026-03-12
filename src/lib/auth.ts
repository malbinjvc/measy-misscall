import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { tenant: true },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        // Check if tenant is disabled
        if (user.tenant && user.tenant.status === "DISABLED") {
          throw new Error("Your account has been disabled. Contact support.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantStatus: user.tenant?.status ?? null,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantStatus = user.tenantStatus;
      }

      // TTL-based DB refresh: only hit DB every 5 minutes instead of every request
      const STATUS_REFRESH_TTL_MS = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();
      const lastChecked = (token.statusCheckedAt as number) || 0;
      const needsRefresh = trigger === "update" || now - lastChecked > STATUS_REFRESH_TTL_MS;

      // SUPER_ADMIN impersonation check — always runs (1 lightweight PK query).
      // Impersonation changes must take effect immediately, not after TTL expires.
      if (token.role === "SUPER_ADMIN") {
        try {
          const adminUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { impersonatingTenantId: true },
          });

          const currentImpersonatingId = adminUser?.impersonatingTenantId || null;
          const tokenImpersonatingId = token.isImpersonating ? (token.tenantId as string) : null;
          const impersonationChanged = currentImpersonatingId !== tokenImpersonatingId;

          if (adminUser?.impersonatingTenantId) {
            // Only fetch target tenant if impersonation changed or TTL expired
            if (impersonationChanged || needsRefresh) {
              const targetTenant = await prisma.tenant.findUnique({
                where: { id: adminUser.impersonatingTenantId },
                select: { id: true, status: true },
              });
              if (targetTenant) {
                token.tenantId = targetTenant.id;
                token.tenantStatus = targetTenant.status;
                token.isImpersonating = true;
              } else {
                await prisma.user.update({
                  where: { id: token.id as string },
                  data: { impersonatingTenantId: null },
                });
                token.tenantId = null;
                token.tenantStatus = null;
                token.isImpersonating = false;
              }
              token.statusCheckedAt = now;
            }
          } else {
            token.tenantId = null;
            token.tenantStatus = null;
            token.isImpersonating = false;
            if (impersonationChanged) {
              token.statusCheckedAt = now;
            }
          }
        } catch (error) {
          console.error("Failed to check impersonation in JWT callback:", error);
        }
      }

      // Refresh tenant status (only when TTL expired, non-impersonating tenant users)
      if (token.tenantId && !token.isImpersonating && needsRefresh) {
        try {
          const tenant = await prisma.tenant.findUnique({
            where: { id: token.tenantId },
            select: { status: true },
          });
          if (tenant) {
            token.tenantStatus = tenant.status;
          } else {
            // Tenant was deleted — mark as disabled so middleware/guards catch it
            token.tenantId = null;
            token.tenantStatus = "DISABLED";
          }
          token.statusCheckedAt = now;
        } catch (error) {
          console.error("Failed to refresh tenant status in JWT callback:", error);
          // Return token as-is without tenant status refresh so auth isn't broken
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.tenantId = token.tenantId;
      session.user.tenantStatus = token.tenantStatus;
      session.user.isImpersonating = token.isImpersonating ?? false;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
