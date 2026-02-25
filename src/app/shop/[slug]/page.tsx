"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingPage } from "@/components/shared/loading";
import { Phone, MapPin, Clock, Calendar, Wrench, MessageSquare } from "lucide-react";

export default function ShopPage({ params }: { params: { slug: string } }) {
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/shop/${params.slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setShop(data.data);
        } else {
          setError("Business not found");
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading) return <LoadingPage />;
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Business Not Found</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{shop.name}</h1>
              {shop.city && <p className="text-sm text-muted-foreground">{shop.city}, {shop.state}</p>}
            </div>
            <Link href={`/shop/${params.slug}/book`}>
              <Button><Calendar className="mr-2 h-4 w-4" /> Book Now</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* About */}
        {shop.description && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">{shop.description}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Services */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" /> Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {shop.services?.map((service: any) => (
                  <div key={service.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{service.name}</p>
                      <p className="text-xs text-muted-foreground">{service.duration} min</p>
                    </div>
                    {service.price && (
                      <Badge variant="secondary">${service.price}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Contact & Hours */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" /> Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {shop.phone && <p className="text-sm flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {shop.phone}</p>}
                {shop.address && (
                  <p className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {shop.address}{shop.city && `, ${shop.city}`}{shop.state && `, ${shop.state}`} {shop.zipCode}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Business Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {dayOrder.map((day) => {
                    const hours = shop.businessHours?.find((h: any) => h.day === day);
                    return (
                      <div key={day} className="flex justify-between text-sm py-1">
                        <span className="capitalize font-medium">{day.toLowerCase()}</span>
                        <span className="text-muted-foreground">
                          {hours?.isOpen ? `${hours.openTime} - ${hours.closeTime}` : "Closed"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA */}
        <div className="flex gap-4 mt-8 justify-center">
          <Link href={`/shop/${params.slug}/book`}>
            <Button size="lg"><Calendar className="mr-2 h-4 w-4" /> Book Appointment</Button>
          </Link>
          <Link href={`/shop/${params.slug}/complaint`}>
            <Button variant="outline" size="lg"><MessageSquare className="mr-2 h-4 w-4" /> Submit Feedback</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
