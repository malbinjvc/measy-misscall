import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createServiceSchema, updateServiceSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const services = await prisma.service.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { sortOrder: "asc" },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
          include: { subOptions: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });

    return NextResponse.json({ success: true, data: services });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = createServiceSchema.parse(body);

    const count = await prisma.service.count({ where: { tenantId: session.user.tenantId } });

    const { options, ...serviceData } = validated;

    const service = await prisma.service.create({
      data: {
        ...serviceData,
        tenantId: session.user.tenantId,
        sortOrder: count,
        ...(options?.length
          ? {
              options: {
                create: options.map((opt, idx) => ({
                  name: opt.name,
                  description: opt.description,
                  duration: opt.duration ?? null,
                  price: opt.price ?? null,
                  isActive: opt.isActive,
                  sortOrder: idx,
                  defaultQuantity: opt.defaultQuantity ?? 1,
                  minQuantity: opt.minQuantity ?? 1,
                  maxQuantity: opt.maxQuantity ?? 10,
                  ...(opt.subOptions?.length
                    ? {
                        subOptions: {
                          create: opt.subOptions.map((sub, subIdx) => ({
                            name: sub.name,
                            description: sub.description,
                            price: sub.price ?? null,
                            sortOrder: subIdx,
                          })),
                        },
                      }
                    : {}),
                })),
              },
            }
          : {}),
      },
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
          include: { subOptions: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });

    return NextResponse.json({ success: true, data: service });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ success: false, error: "Validation failed", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Failed to create" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...data } = body;
    const validated = updateServiceSchema.parse(data);

    const service = await prisma.service.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!service) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const { options, ...serviceData } = validated;

    // If options are provided, delete existing (cascade deletes sub-options) and recreate
    if (options !== undefined) {
      await prisma.serviceSubOption.deleteMany({
        where: { serviceOption: { serviceId: id } },
      });
      await prisma.serviceOption.deleteMany({ where: { serviceId: id } });
      if (options && options.length > 0) {
        for (let idx = 0; idx < options.length; idx++) {
          const opt = options[idx];
          await prisma.serviceOption.create({
            data: {
              name: opt.name!,
              description: opt.description,
              duration: opt.duration ?? null,
              price: opt.price ?? null,
              isActive: opt.isActive ?? true,
              sortOrder: idx,
              defaultQuantity: opt.defaultQuantity ?? 1,
              minQuantity: opt.minQuantity ?? 1,
              maxQuantity: opt.maxQuantity ?? 10,
              serviceId: id,
              ...(opt.subOptions?.length
                ? {
                    subOptions: {
                      create: opt.subOptions.map((sub: any, subIdx: number) => ({
                        name: sub.name,
                        description: sub.description,
                        price: sub.price ?? null,
                        sortOrder: subIdx,
                      })),
                    },
                  }
                : {}),
            },
          });
        }
      }
    }

    const updated = await prisma.service.update({
      where: { id },
      data: serviceData,
      include: {
        options: {
          orderBy: { sortOrder: "asc" },
          include: { subOptions: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();

    const service = await prisma.service.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });
    if (!service) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Delete failed" }, { status: 500 });
  }
}
