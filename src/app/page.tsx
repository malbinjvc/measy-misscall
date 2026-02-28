import Link from "next/link";
import { Phone, Calendar, MessageSquare, Shield, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Measy MissCall</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Never Lose a Customer
          <br />
          <span className="text-primary">to a Missed Call Again</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Automatically handle missed calls with IVR, send SMS booking links,
          and let customers schedule appointments online. Built for auto shops
          and service businesses.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition"
          >
            Start Free Trial <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center gap-2 rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent transition"
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<Phone className="h-8 w-8 text-primary" />}
            title="Missed Call Detection"
            description="When a call goes unanswered, our IVR system automatically kicks in to capture customer intent."
          />
          <FeatureCard
            icon={<MessageSquare className="h-8 w-8 text-primary" />}
            title="Smart IVR & SMS"
            description="Customers choose callback via IVR, then receive an SMS with a booking link."
          />
          <FeatureCard
            icon={<Calendar className="h-8 w-8 text-primary" />}
            title="Online Booking"
            description="Customers book appointments directly from the SMS link. No phone tag needed."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-primary" />}
            title="Full Dashboard"
            description="Track all calls, appointments, and SMS logs from a single dashboard."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Measy MissCall. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <div className="mb-4">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
