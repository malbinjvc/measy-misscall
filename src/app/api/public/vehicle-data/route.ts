import { NextRequest, NextResponse } from "next/server";

const NHTSA_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type"); // "makes" or "models"
  const year = searchParams.get("year");
  const make = searchParams.get("make");
  const vehicleType = searchParams.get("vehicleType") || "car";

  // Map UI vehicle types to NHTSA API types
  const nhtsaTypeMap: Record<string, string> = {
    car: "car",
    truck: "truck",
    suv: "multipurpose passenger vehicle (mpv)",
    van: "multipurpose passenger vehicle (mpv)",
    motorcycle: "motorcycle",
  };
  const nhtsaType = nhtsaTypeMap[vehicleType.toLowerCase()] || "car";

  try {
    if (type === "makes") {
      const res = await fetch(
        `${NHTSA_BASE}/GetMakesForVehicleType/${encodeURIComponent(nhtsaType)}?format=json`,
        { next: { revalidate: 86400 } } // cache for 24h
      );
      if (!res.ok) throw new Error("NHTSA API error");
      const data = await res.json();
      const makes: string[] = (data.Results || [])
        .map((r: { MakeName: string }) => r.MakeName)
        .sort((a: string, b: string) => a.localeCompare(b));
      return NextResponse.json({ success: true, data: makes });
    }

    if (type === "models" && year && make) {
      const res = await fetch(
        `${NHTSA_BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`,
        { next: { revalidate: 86400 } }
      );
      if (!res.ok) throw new Error("NHTSA API error");
      const data = await res.json();
      const models: string[] = (data.Results || [])
        .map((r: { Model_Name: string }) => r.Model_Name)
        .sort((a: string, b: string) => a.localeCompare(b));
      return NextResponse.json({ success: true, data: models });
    }

    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch vehicle data" }, { status: 502 });
  }
}
