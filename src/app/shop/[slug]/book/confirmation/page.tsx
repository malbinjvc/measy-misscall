"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft, User } from "lucide-react";

export default function BookingConfirmationPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(`/shop/${params.slug}/account`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router, params.slug]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Booking Confirmed!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your appointment has been booked successfully. The business will confirm your appointment shortly.
          </p>
          <p className="text-sm text-muted-foreground">
            Redirecting to your account in {countdown}s...
          </p>
          <div className="flex flex-col gap-2">
            <Link href={`/shop/${params.slug}/account`}>
              <Button className="w-full">
                <User className="mr-2 h-4 w-4" /> Go to My Account
              </Button>
            </Link>
            <Link href={`/shop/${params.slug}`}>
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shop
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
