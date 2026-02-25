"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowLeft } from "lucide-react";

export default function ComplaintConfirmationPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense>
      <ComplaintConfirmationContent slug={params.slug} />
    </Suspense>
  );
}

function ComplaintConfirmationContent({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const referenceNumber = searchParams.get("ref");

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Feedback Submitted!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Thank you for your feedback. We will review it and get back to you as soon as possible.
          </p>
          {referenceNumber && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">Reference Number</p>
              <p className="text-lg font-mono font-bold">{referenceNumber}</p>
            </div>
          )}
          <Link href={`/shop/${slug}`}>
            <Button variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Shop
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
