export interface SampleServiceOption {
  name: string;
  description: string;
  price: number;
  duration: number | null; // null = inherit from parent service
}

export interface SampleService {
  name: string;
  description: string;
  duration: number; // minutes
  price: number;
  options?: SampleServiceOption[];
}

export const DEFAULT_SAMPLE_SERVICES: SampleService[] = [
  {
    name: "Consultation",
    description: "Initial consultation to discuss your needs",
    duration: 30,
    price: 0,
    options: [
      { name: "Phone Consultation", description: "Quick phone-based discussion", price: 0, duration: 15 },
      { name: "In-Person Consultation", description: "Face-to-face meeting at our location", price: 0, duration: 30 },
      { name: "Video Consultation", description: "Virtual meeting via video call", price: 0, duration: 30 },
    ],
  },
  {
    name: "Standard Service",
    description: "Our standard service package",
    duration: 60,
    price: 50,
    options: [
      { name: "Basic", description: "Essential service coverage", price: 50, duration: 45 },
      { name: "Standard", description: "Full standard service", price: 75, duration: 60 },
      { name: "Extended", description: "Extended service with extra attention", price: 100, duration: 90 },
    ],
  },
  {
    name: "Premium Service",
    description: "Our premium full-service package",
    duration: 90,
    price: 100,
    options: [
      { name: "Premium", description: "Premium service package", price: 100, duration: 90 },
      { name: "VIP", description: "Top-tier VIP experience", price: 150, duration: 120 },
    ],
  },
];

export const INDUSTRY_SAMPLE_SERVICES: Record<string, SampleService[]> = {
  // ──────────────────────────────────────
  // Automotive
  // ──────────────────────────────────────
  auto_repair: [
    {
      name: "Oil Change",
      description: "Full synthetic oil change with filter replacement",
      duration: 30,
      price: 50,
      options: [
        { name: "Conventional Oil", description: "Standard conventional motor oil", price: 35, duration: 25 },
        { name: "Synthetic Blend", description: "Semi-synthetic oil blend", price: 50, duration: 30 },
        { name: "Full Synthetic", description: "Premium full synthetic motor oil", price: 70, duration: 30 },
        { name: "High Mileage Oil", description: "Designed for vehicles with 75k+ miles", price: 65, duration: 30 },
      ],
    },
    {
      name: "Brake Inspection",
      description: "Complete brake system inspection and diagnosis",
      duration: 45,
      price: 40,
      options: [
        { name: "Front Brakes Only", description: "Inspect front brake pads and rotors", price: 30, duration: 30 },
        { name: "Rear Brakes Only", description: "Inspect rear brake pads and rotors", price: 30, duration: 30 },
        { name: "Full Brake System", description: "Complete front and rear brake inspection", price: 40, duration: 45 },
        { name: "Brake Fluid Flush", description: "Flush and replace brake fluid", price: 60, duration: 30 },
      ],
    },
    {
      name: "Tire Rotation",
      description: "Rotate and balance all four tires",
      duration: 30,
      price: 35,
      options: [
        { name: "Standard Rotation", description: "4-tire rotation and pressure check", price: 35, duration: 30 },
        { name: "Rotation + Balance", description: "Rotate and balance all four tires", price: 55, duration: 45 },
        { name: "Rotation + Alignment Check", description: "Rotation with wheel alignment inspection", price: 65, duration: 45 },
      ],
    },
    {
      name: "Engine Diagnostic",
      description: "Full engine diagnostic scan and report",
      duration: 60,
      price: 80,
      options: [
        { name: "Basic Scan", description: "OBD-II code reading and basic diagnosis", price: 50, duration: 30 },
        { name: "Full Diagnostic", description: "Comprehensive computer diagnostic with report", price: 80, duration: 60 },
        { name: "Electrical System Check", description: "Battery, alternator, and starter testing", price: 60, duration: 45 },
        { name: "Emissions Diagnostic", description: "Emissions system scan and troubleshooting", price: 70, duration: 45 },
      ],
    },
  ],

  auto_detailing: [
    {
      name: "Exterior Wash & Wax",
      description: "Hand wash, clay bar, and wax application",
      duration: 60,
      price: 80,
      options: [
        { name: "Basic Wash", description: "Hand wash and dry", price: 40, duration: 30 },
        { name: "Wash & Wax", description: "Hand wash with spray wax finish", price: 80, duration: 60 },
        { name: "Full Paint Protection", description: "Clay bar, polish, and sealant", price: 150, duration: 120 },
      ],
    },
    {
      name: "Interior Detail",
      description: "Deep clean seats, carpets, and dashboard",
      duration: 90,
      price: 100,
      options: [
        { name: "Basic Interior", description: "Vacuum and wipe-down", price: 60, duration: 45 },
        { name: "Full Interior", description: "Deep clean all surfaces and upholstery", price: 100, duration: 90 },
        { name: "Interior + Leather Care", description: "Full clean with leather conditioning", price: 130, duration: 120 },
      ],
    },
    {
      name: "Full Detail",
      description: "Complete interior and exterior detailing",
      duration: 180,
      price: 200,
      options: [
        { name: "Sedan / Coupe", description: "Full detail for smaller vehicles", price: 180, duration: 150 },
        { name: "SUV / Truck", description: "Full detail for larger vehicles", price: 220, duration: 180 },
        { name: "Van / XL Vehicle", description: "Full detail for oversized vehicles", price: 280, duration: 240 },
      ],
    },
    {
      name: "Paint Correction",
      description: "Single-stage paint correction and polish",
      duration: 120,
      price: 150,
      options: [
        { name: "Single-Stage", description: "Light paint correction and polish", price: 150, duration: 120 },
        { name: "Two-Stage", description: "Compound and polish for deeper scratches", price: 250, duration: 180 },
        { name: "Ceramic Coating", description: "Paint correction with ceramic coat application", price: 400, duration: 240 },
      ],
    },
  ],

  towing: [
    {
      name: "Local Tow",
      description: "Towing within 10-mile radius",
      duration: 30,
      price: 75,
      options: [
        { name: "Flatbed Tow", description: "Flatbed truck for safe transport", price: 95, duration: 30 },
        { name: "Wheel-Lift Tow", description: "Standard wheel-lift tow", price: 75, duration: 30 },
        { name: "Motorcycle Tow", description: "Secure motorcycle transport", price: 65, duration: 30 },
      ],
    },
    {
      name: "Long Distance Tow",
      description: "Towing beyond 10 miles",
      duration: 60,
      price: 150,
      options: [
        { name: "10-25 Miles", description: "Medium distance tow", price: 150, duration: 45 },
        { name: "25-50 Miles", description: "Extended distance tow", price: 250, duration: 60 },
        { name: "50+ Miles", description: "Long haul tow — call for quote", price: 400, duration: 90 },
      ],
    },
    {
      name: "Jump Start",
      description: "Battery jump start service",
      duration: 20,
      price: 50,
      options: [
        { name: "Standard Jump", description: "Battery jump start", price: 50, duration: 20 },
        { name: "Battery Test & Jump", description: "Test battery health and jump start", price: 70, duration: 30 },
      ],
    },
    {
      name: "Flat Tire Change",
      description: "Roadside tire change with your spare",
      duration: 30,
      price: 60,
      options: [
        { name: "Spare Tire Mount", description: "Mount your spare tire on-site", price: 60, duration: 30 },
        { name: "Tire Inflation", description: "Inflate and seal minor puncture", price: 40, duration: 20 },
      ],
    },
  ],

  tire_shop: [
    {
      name: "Tire Installation",
      description: "Mount and balance a single tire",
      duration: 30,
      price: 25,
      options: [
        { name: "Standard Tire", description: "Install standard passenger tire", price: 25, duration: 20 },
        { name: "Performance Tire", description: "Install performance or low-profile tire", price: 35, duration: 30 },
        { name: "Truck / SUV Tire", description: "Install larger truck or SUV tire", price: 40, duration: 30 },
      ],
    },
    {
      name: "Full Set Installation",
      description: "Mount and balance four tires",
      duration: 60,
      price: 80,
      options: [
        { name: "Standard Set", description: "Four standard passenger tires", price: 80, duration: 60 },
        { name: "Performance Set", description: "Four performance tires", price: 120, duration: 75 },
        { name: "Truck / SUV Set", description: "Four truck or SUV tires", price: 140, duration: 75 },
      ],
    },
    {
      name: "Wheel Alignment",
      description: "Four-wheel alignment service",
      duration: 45,
      price: 90,
      options: [
        { name: "Two-Wheel Alignment", description: "Front-end alignment only", price: 60, duration: 30 },
        { name: "Four-Wheel Alignment", description: "Full four-wheel alignment", price: 90, duration: 45 },
      ],
    },
    {
      name: "Tire Repair",
      description: "Patch or plug tire puncture",
      duration: 20,
      price: 25,
      options: [
        { name: "Plug Repair", description: "Quick plug for tread puncture", price: 20, duration: 15 },
        { name: "Patch Repair", description: "Internal patch for lasting seal", price: 30, duration: 25 },
      ],
    },
  ],

  auto_body: [
    {
      name: "Damage Estimate",
      description: "Detailed damage assessment and repair estimate",
      duration: 30,
      price: 0,
      options: [
        { name: "Visual Estimate", description: "On-site visual assessment", price: 0, duration: 20 },
        { name: "Photo Estimate", description: "Submit photos for remote estimate", price: 0, duration: 15 },
        { name: "Insurance Estimate", description: "Full estimate for insurance claim", price: 0, duration: 45 },
      ],
    },
    {
      name: "Dent Repair",
      description: "Paintless dent removal for minor dents",
      duration: 60,
      price: 100,
      options: [
        { name: "Small Dent", description: "Single dent under 1 inch", price: 75, duration: 30 },
        { name: "Medium Dent", description: "Single dent 1-3 inches", price: 100, duration: 45 },
        { name: "Multiple Dents", description: "2-5 small dents on one panel", price: 175, duration: 60 },
      ],
    },
    {
      name: "Scratch Repair",
      description: "Touch-up and buff out surface scratches",
      duration: 45,
      price: 80,
      options: [
        { name: "Surface Scratch", description: "Buff out clear-coat scratches", price: 60, duration: 30 },
        { name: "Deep Scratch", description: "Fill and repaint deep scratches", price: 120, duration: 60 },
        { name: "Full Panel Repaint", description: "Sand, prime, and repaint entire panel", price: 300, duration: 180 },
      ],
    },
    {
      name: "Bumper Repair",
      description: "Repair and refinish damaged bumper",
      duration: 120,
      price: 250,
      options: [
        { name: "Minor Scuff Repair", description: "Buff and touch up light scuffs", price: 120, duration: 60 },
        { name: "Crack Repair", description: "Plastic weld and refinish cracks", price: 250, duration: 120 },
        { name: "Full Bumper Replacement", description: "Replace and paint new bumper", price: 500, duration: 240 },
      ],
    },
  ],

  // ──────────────────────────────────────
  // Health & Beauty
  // ──────────────────────────────────────
  barbershop: [
    {
      name: "Haircut",
      description: "Classic men's haircut with styling",
      duration: 30,
      price: 25,
      options: [
        { name: "Standard Cut", description: "Classic scissor or clipper cut", price: 25, duration: 30 },
        { name: "Skin Fade", description: "Precision skin fade haircut", price: 30, duration: 35 },
        { name: "Kids Cut", description: "Haircut for children under 12", price: 18, duration: 20 },
      ],
    },
    {
      name: "Beard Trim",
      description: "Beard shaping and trimming",
      duration: 20,
      price: 15,
      options: [
        { name: "Quick Trim", description: "Basic beard line-up and trim", price: 15, duration: 15 },
        { name: "Full Beard Shape", description: "Detailed shaping with razor edges", price: 20, duration: 25 },
      ],
    },
    {
      name: "Haircut & Beard Combo",
      description: "Full haircut with beard trim and styling",
      duration: 45,
      price: 35,
      options: [
        { name: "Classic Combo", description: "Standard cut with beard trim", price: 35, duration: 40 },
        { name: "Premium Combo", description: "Fade cut with detailed beard shape", price: 45, duration: 50 },
      ],
    },
    {
      name: "Hot Towel Shave",
      description: "Traditional straight razor hot towel shave",
      duration: 30,
      price: 30,
      options: [
        { name: "Full Shave", description: "Complete straight razor shave", price: 30, duration: 30 },
        { name: "Shave & Facial", description: "Straight razor shave with facial massage", price: 45, duration: 45 },
      ],
    },
  ],

  hair_salon: [
    {
      name: "Haircut & Style",
      description: "Precision cut with blow-dry styling",
      duration: 45,
      price: 55,
      options: [
        { name: "Women's Cut", description: "Full cut and blow-dry styling", price: 55, duration: 45 },
        { name: "Men's Cut", description: "Precision men's cut and style", price: 35, duration: 30 },
        { name: "Kids Cut", description: "Cut for children under 12", price: 25, duration: 25 },
      ],
    },
    {
      name: "Color Service",
      description: "Single-process hair color application",
      duration: 90,
      price: 100,
      options: [
        { name: "Root Touch-Up", description: "Color regrowth coverage only", price: 75, duration: 60 },
        { name: "Full Color", description: "All-over single-process color", price: 100, duration: 90 },
        { name: "Double Process", description: "Lightening and toning in one visit", price: 160, duration: 120 },
      ],
    },
    {
      name: "Highlights",
      description: "Partial or full highlights",
      duration: 120,
      price: 150,
      options: [
        { name: "Partial Highlights", description: "Face-framing and top highlights", price: 100, duration: 90 },
        { name: "Full Highlights", description: "All-over foil highlights", price: 150, duration: 120 },
        { name: "Balayage", description: "Hand-painted natural highlights", price: 180, duration: 150 },
      ],
    },
    {
      name: "Blowout",
      description: "Shampoo and professional blow-dry",
      duration: 30,
      price: 40,
      options: [
        { name: "Standard Blowout", description: "Wash and round-brush blow-dry", price: 40, duration: 30 },
        { name: "Blowout + Curl", description: "Blow-dry with curling iron finish", price: 55, duration: 45 },
      ],
    },
  ],

  nail_salon: [
    {
      name: "Manicure",
      description: "Classic manicure with polish",
      duration: 30,
      price: 25,
      options: [
        { name: "Classic Manicure", description: "Shape, cuticle care, and polish", price: 25, duration: 30 },
        { name: "Gel Manicure", description: "Long-lasting gel polish application", price: 40, duration: 40 },
        { name: "Dip Powder Manicure", description: "Durable dip powder application", price: 45, duration: 45 },
      ],
    },
    {
      name: "Pedicure",
      description: "Classic pedicure with polish",
      duration: 45,
      price: 35,
      options: [
        { name: "Classic Pedicure", description: "Soak, exfoliate, and polish", price: 35, duration: 45 },
        { name: "Gel Pedicure", description: "Pedicure with gel polish", price: 50, duration: 55 },
        { name: "Spa Pedicure", description: "Deluxe pedicure with hot stone massage", price: 60, duration: 60 },
      ],
    },
    {
      name: "Gel Manicure",
      description: "Long-lasting gel polish manicure",
      duration: 45,
      price: 40,
      options: [
        { name: "Gel Color", description: "Standard gel color application", price: 40, duration: 40 },
        { name: "Gel French", description: "French tip gel application", price: 50, duration: 50 },
        { name: "Gel Removal + New Set", description: "Safe removal and fresh gel set", price: 55, duration: 60 },
      ],
    },
    {
      name: "Mani-Pedi Combo",
      description: "Full manicure and pedicure package",
      duration: 75,
      price: 55,
      options: [
        { name: "Classic Combo", description: "Classic manicure and pedicure", price: 55, duration: 75 },
        { name: "Gel Combo", description: "Gel manicure with classic pedicure", price: 75, duration: 90 },
        { name: "Deluxe Combo", description: "Gel mani and spa pedicure", price: 95, duration: 105 },
      ],
    },
  ],

  spa: [
    {
      name: "Swedish Massage",
      description: "Relaxing full-body Swedish massage",
      duration: 60,
      price: 90,
      options: [
        { name: "30 Minutes", description: "Focused area massage", price: 55, duration: 30 },
        { name: "60 Minutes", description: "Full-body relaxation", price: 90, duration: 60 },
        { name: "90 Minutes", description: "Extended full-body massage", price: 130, duration: 90 },
      ],
    },
    {
      name: "Deep Tissue Massage",
      description: "Targeted deep tissue work for tension relief",
      duration: 60,
      price: 110,
      options: [
        { name: "30 Minutes", description: "Targeted deep tissue on problem areas", price: 70, duration: 30 },
        { name: "60 Minutes", description: "Full-body deep tissue work", price: 110, duration: 60 },
        { name: "90 Minutes", description: "Comprehensive deep tissue session", price: 155, duration: 90 },
      ],
    },
    {
      name: "Facial Treatment",
      description: "Customized facial with cleanse and mask",
      duration: 60,
      price: 85,
      options: [
        { name: "Express Facial", description: "Quick refresh with cleanse and mask", price: 55, duration: 30 },
        { name: "Classic Facial", description: "Full facial with extractions", price: 85, duration: 60 },
        { name: "Anti-Aging Facial", description: "Premium anti-aging treatment", price: 120, duration: 75 },
      ],
    },
    {
      name: "Hot Stone Massage",
      description: "Heated stone relaxation massage",
      duration: 75,
      price: 120,
      options: [
        { name: "60 Minutes", description: "Standard hot stone session", price: 120, duration: 60 },
        { name: "90 Minutes", description: "Extended hot stone relaxation", price: 165, duration: 90 },
      ],
    },
  ],

  chiropractic: [
    {
      name: "Initial Consultation",
      description: "New patient exam and assessment",
      duration: 60,
      price: 100,
      options: [
        { name: "Basic Exam", description: "Physical exam and history review", price: 80, duration: 45 },
        { name: "Comprehensive Exam", description: "Full exam with posture analysis", price: 100, duration: 60 },
        { name: "Exam + X-Rays", description: "Full exam with diagnostic X-rays", price: 180, duration: 75 },
      ],
    },
    {
      name: "Adjustment",
      description: "Spinal adjustment and alignment",
      duration: 30,
      price: 65,
      options: [
        { name: "Single Region", description: "Adjust one spinal region", price: 50, duration: 20 },
        { name: "Full Spine", description: "Complete spinal adjustment", price: 65, duration: 30 },
        { name: "Full Spine + Extremities", description: "Spine and joint adjustments", price: 85, duration: 40 },
      ],
    },
    {
      name: "Adjustment & Therapy",
      description: "Adjustment with therapeutic exercises",
      duration: 45,
      price: 85,
      options: [
        { name: "Adjustment + Stretching", description: "Adjustment with guided stretches", price: 75, duration: 35 },
        { name: "Adjustment + E-Stim", description: "Adjustment with electrical stimulation", price: 85, duration: 45 },
        { name: "Adjustment + Full Rehab", description: "Adjustment with full rehabilitation exercises", price: 110, duration: 60 },
      ],
    },
    {
      name: "X-Ray Analysis",
      description: "Spinal X-ray and analysis",
      duration: 30,
      price: 120,
      options: [
        { name: "Single View", description: "One X-ray view", price: 80, duration: 20 },
        { name: "Full Spine Series", description: "Multiple views of entire spine", price: 120, duration: 30 },
      ],
    },
  ],

  // ──────────────────────────────────────
  // Healthcare
  // ──────────────────────────────────────
  dental: [
    {
      name: "Dental Cleaning",
      description: "Professional teeth cleaning and polishing",
      duration: 60,
      price: 150,
      options: [
        { name: "Standard Cleaning", description: "Routine prophylaxis cleaning", price: 150, duration: 45 },
        { name: "Deep Cleaning", description: "Scaling and root planing per quadrant", price: 250, duration: 60 },
        { name: "Perio Maintenance", description: "Post-treatment periodontal maintenance", price: 180, duration: 50 },
      ],
    },
    {
      name: "Dental Exam",
      description: "Comprehensive oral exam with X-rays",
      duration: 30,
      price: 80,
      options: [
        { name: "Basic Exam", description: "Visual oral exam", price: 60, duration: 20 },
        { name: "Exam + Bitewings", description: "Exam with bitewing X-rays", price: 80, duration: 30 },
        { name: "Full Mouth X-Ray", description: "Comprehensive full-mouth series", price: 120, duration: 40 },
      ],
    },
    {
      name: "Teeth Whitening",
      description: "In-office professional whitening treatment",
      duration: 60,
      price: 300,
      options: [
        { name: "Standard Whitening", description: "Single session in-office whitening", price: 300, duration: 60 },
        { name: "Premium Whitening", description: "Advanced whitening with sensitivity care", price: 450, duration: 75 },
        { name: "Take-Home Kit", description: "Custom tray whitening kit", price: 200, duration: 30 },
      ],
    },
    {
      name: "Filling",
      description: "Composite filling for a single tooth",
      duration: 45,
      price: 200,
      options: [
        { name: "Small Filling", description: "One-surface composite filling", price: 150, duration: 30 },
        { name: "Medium Filling", description: "Two-surface composite filling", price: 200, duration: 45 },
        { name: "Large Filling", description: "Three+ surface composite filling", price: 275, duration: 60 },
      ],
    },
  ],

  medical_clinic: [
    {
      name: "General Checkup",
      description: "Routine physical examination",
      duration: 30,
      price: 120,
      options: [
        { name: "Standard Checkup", description: "Basic annual physical", price: 120, duration: 30 },
        { name: "Comprehensive Physical", description: "Full physical with extended panel", price: 200, duration: 45 },
        { name: "Executive Health Screen", description: "Premium head-to-toe evaluation", price: 350, duration: 60 },
      ],
    },
    {
      name: "Sick Visit",
      description: "Evaluation and treatment for illness",
      duration: 20,
      price: 100,
      options: [
        { name: "Quick Visit", description: "Brief evaluation for minor symptoms", price: 80, duration: 15 },
        { name: "Standard Visit", description: "Full evaluation and treatment plan", price: 100, duration: 20 },
        { name: "Extended Visit", description: "Complex symptoms requiring longer evaluation", price: 150, duration: 30 },
      ],
    },
    {
      name: "Lab Work",
      description: "Blood draw and standard lab panel",
      duration: 15,
      price: 80,
      options: [
        { name: "Basic Panel", description: "CBC and metabolic panel", price: 80, duration: 15 },
        { name: "Comprehensive Panel", description: "Extended blood work with lipids and thyroid", price: 150, duration: 15 },
        { name: "Wellness Panel", description: "Full wellness screen with hormone levels", price: 250, duration: 15 },
      ],
    },
    {
      name: "Follow-Up Visit",
      description: "Follow-up on previous treatment or results",
      duration: 15,
      price: 75,
      options: [
        { name: "Brief Follow-Up", description: "Quick status check", price: 60, duration: 10 },
        { name: "Standard Follow-Up", description: "Review results and adjust treatment", price: 75, duration: 15 },
      ],
    },
  ],

  pharmacy: [
    {
      name: "Prescription Consultation",
      description: "Medication review and counseling",
      duration: 15,
      price: 0,
      options: [
        { name: "Quick Question", description: "Brief medication question", price: 0, duration: 5 },
        { name: "Full Consultation", description: "Detailed medication review", price: 0, duration: 15 },
      ],
    },
    {
      name: "Flu Shot",
      description: "Seasonal flu vaccination",
      duration: 10,
      price: 30,
      options: [
        { name: "Standard Flu Shot", description: "Standard seasonal flu vaccine", price: 30, duration: 10 },
        { name: "High-Dose Flu Shot", description: "High-dose vaccine for seniors", price: 50, duration: 10 },
      ],
    },
    {
      name: "Health Screening",
      description: "Blood pressure and glucose screening",
      duration: 15,
      price: 20,
      options: [
        { name: "Blood Pressure Check", description: "Quick blood pressure reading", price: 10, duration: 5 },
        { name: "Glucose + BP Check", description: "Blood glucose and blood pressure", price: 20, duration: 15 },
        { name: "Full Screening", description: "BP, glucose, and cholesterol panel", price: 40, duration: 20 },
      ],
    },
    {
      name: "Medication Therapy Review",
      description: "Comprehensive medication management review",
      duration: 30,
      price: 50,
      options: [
        { name: "Basic Review", description: "Review for 1-5 medications", price: 35, duration: 20 },
        { name: "Comprehensive Review", description: "Full review for 5+ medications", price: 50, duration: 30 },
      ],
    },
  ],

  physiotherapy: [
    {
      name: "Initial Assessment",
      description: "Comprehensive physical therapy evaluation",
      duration: 60,
      price: 120,
      options: [
        { name: "Standard Assessment", description: "Full evaluation and treatment plan", price: 120, duration: 60 },
        { name: "Sports Injury Assessment", description: "Sport-specific movement assessment", price: 140, duration: 60 },
      ],
    },
    {
      name: "Treatment Session",
      description: "Hands-on therapy and exercise session",
      duration: 45,
      price: 90,
      options: [
        { name: "30-Minute Session", description: "Focused treatment on one area", price: 65, duration: 30 },
        { name: "45-Minute Session", description: "Standard treatment session", price: 90, duration: 45 },
        { name: "60-Minute Session", description: "Extended treatment session", price: 115, duration: 60 },
      ],
    },
    {
      name: "Rehabilitation Program",
      description: "Structured rehab session with exercises",
      duration: 60,
      price: 100,
      options: [
        { name: "Post-Surgery Rehab", description: "Post-operative rehabilitation", price: 110, duration: 60 },
        { name: "Sports Rehab", description: "Athletic injury recovery", price: 100, duration: 60 },
        { name: "Chronic Pain Management", description: "Ongoing pain management program", price: 100, duration: 60 },
      ],
    },
    {
      name: "Manual Therapy",
      description: "Targeted manual therapy techniques",
      duration: 30,
      price: 75,
      options: [
        { name: "Joint Mobilization", description: "Gentle joint movement techniques", price: 75, duration: 30 },
        { name: "Myofascial Release", description: "Soft tissue release techniques", price: 75, duration: 30 },
        { name: "Dry Needling", description: "Trigger point dry needling", price: 85, duration: 30 },
      ],
    },
  ],

  optometry: [
    {
      name: "Eye Exam",
      description: "Comprehensive vision and eye health exam",
      duration: 30,
      price: 100,
      options: [
        { name: "Standard Exam", description: "Vision test and eye health check", price: 100, duration: 30 },
        { name: "Comprehensive Exam", description: "Thorough exam with dilation", price: 140, duration: 45 },
        { name: "Pediatric Exam", description: "Child-focused eye examination", price: 110, duration: 30 },
      ],
    },
    {
      name: "Contact Lens Fitting",
      description: "Contact lens evaluation and fitting",
      duration: 45,
      price: 120,
      options: [
        { name: "Standard Lenses", description: "Fitting for standard soft lenses", price: 100, duration: 30 },
        { name: "Toric Lenses", description: "Fitting for astigmatism correction", price: 130, duration: 45 },
        { name: "Multifocal Lenses", description: "Fitting for progressive contacts", price: 150, duration: 45 },
      ],
    },
    {
      name: "Frame Selection",
      description: "Assisted eyeglass frame selection and fitting",
      duration: 30,
      price: 0,
      options: [
        { name: "Standard Frames", description: "Select from standard collection", price: 0, duration: 20 },
        { name: "Designer Frames", description: "Select from designer collection", price: 0, duration: 30 },
      ],
    },
    {
      name: "Retinal Imaging",
      description: "Digital retinal scan and analysis",
      duration: 15,
      price: 50,
      options: [
        { name: "Standard Scan", description: "Digital retinal photograph", price: 50, duration: 10 },
        { name: "OCT Scan", description: "Optical coherence tomography", price: 80, duration: 15 },
      ],
    },
  ],

  mental_health: [
    {
      name: "Initial Intake",
      description: "New patient intake and assessment",
      duration: 60,
      price: 150,
      options: [
        { name: "Standard Intake", description: "New patient assessment and history", price: 150, duration: 60 },
        { name: "Comprehensive Intake", description: "Extended assessment with testing", price: 200, duration: 90 },
      ],
    },
    {
      name: "Therapy Session",
      description: "Individual counseling session",
      duration: 50,
      price: 120,
      options: [
        { name: "30-Minute Session", description: "Brief focused session", price: 80, duration: 30 },
        { name: "50-Minute Session", description: "Standard therapy hour", price: 120, duration: 50 },
        { name: "80-Minute Session", description: "Extended session for complex issues", price: 180, duration: 80 },
      ],
    },
    {
      name: "Couples Counseling",
      description: "Couples therapy session",
      duration: 60,
      price: 150,
      options: [
        { name: "Standard Session", description: "50-minute couples session", price: 150, duration: 50 },
        { name: "Extended Session", description: "80-minute in-depth session", price: 200, duration: 80 },
      ],
    },
    {
      name: "Group Therapy",
      description: "Facilitated group therapy session",
      duration: 90,
      price: 60,
      options: [
        { name: "Open Group", description: "Drop-in group session", price: 50, duration: 75 },
        { name: "Closed Group", description: "Ongoing structured group program", price: 60, duration: 90 },
      ],
    },
  ],

  veterinary: [
    {
      name: "Wellness Exam",
      description: "Routine pet health checkup",
      duration: 30,
      price: 60,
      options: [
        { name: "Cat Exam", description: "Feline wellness check", price: 55, duration: 25 },
        { name: "Dog Exam", description: "Canine wellness check", price: 60, duration: 30 },
        { name: "Exotic Pet Exam", description: "Exam for birds, reptiles, or small animals", price: 80, duration: 30 },
      ],
    },
    {
      name: "Vaccination",
      description: "Core pet vaccination package",
      duration: 20,
      price: 40,
      options: [
        { name: "Core Vaccines", description: "Essential required vaccinations", price: 40, duration: 15 },
        { name: "Core + Lifestyle", description: "Core plus lifestyle-based vaccines", price: 70, duration: 20 },
        { name: "Puppy/Kitten Series", description: "Initial vaccination series for young pets", price: 90, duration: 20 },
      ],
    },
    {
      name: "Dental Cleaning",
      description: "Pet dental cleaning under sedation",
      duration: 60,
      price: 200,
      options: [
        { name: "Basic Cleaning", description: "Scaling and polishing", price: 200, duration: 45 },
        { name: "Cleaning + Extractions", description: "Cleaning with tooth removal if needed", price: 350, duration: 90 },
      ],
    },
    {
      name: "Sick Visit",
      description: "Evaluation and treatment for illness or injury",
      duration: 30,
      price: 80,
      options: [
        { name: "Standard Visit", description: "Exam and basic treatment", price: 80, duration: 30 },
        { name: "Urgent Visit", description: "Same-day urgent care evaluation", price: 120, duration: 30 },
      ],
    },
  ],

  // ──────────────────────────────────────
  // Home Services
  // ──────────────────────────────────────
  plumbing: [
    {
      name: "Drain Cleaning",
      description: "Professional drain clearing and cleaning",
      duration: 60,
      price: 120,
      options: [
        { name: "Single Drain", description: "Clear one clogged drain", price: 120, duration: 45 },
        { name: "Multiple Drains", description: "Clear 2-3 drains in one visit", price: 180, duration: 75 },
        { name: "Hydro Jetting", description: "High-pressure water jetting", price: 300, duration: 90 },
      ],
    },
    {
      name: "Leak Repair",
      description: "Locate and repair plumbing leaks",
      duration: 60,
      price: 100,
      options: [
        { name: "Faucet Leak", description: "Repair dripping faucet", price: 80, duration: 30 },
        { name: "Pipe Leak", description: "Repair leaking pipe or joint", price: 120, duration: 60 },
        { name: "Leak Detection", description: "Locate hidden leaks with equipment", price: 150, duration: 60 },
      ],
    },
    {
      name: "Water Heater Service",
      description: "Water heater inspection and maintenance",
      duration: 90,
      price: 150,
      options: [
        { name: "Inspection & Flush", description: "Inspect and flush sediment", price: 150, duration: 60 },
        { name: "Element Replacement", description: "Replace heating element or thermostat", price: 200, duration: 90 },
        { name: "Full Installation", description: "New water heater installation", price: 500, duration: 180 },
      ],
    },
    {
      name: "Faucet Installation",
      description: "Install or replace a faucet fixture",
      duration: 45,
      price: 90,
      options: [
        { name: "Kitchen Faucet", description: "Install kitchen faucet", price: 100, duration: 45 },
        { name: "Bathroom Faucet", description: "Install bathroom faucet", price: 90, duration: 40 },
        { name: "Outdoor Spigot", description: "Install or replace outdoor faucet", price: 110, duration: 45 },
      ],
    },
  ],

  electrical: [
    {
      name: "Outlet Installation",
      description: "Install or replace an electrical outlet",
      duration: 30,
      price: 80,
      options: [
        { name: "Standard Outlet", description: "Standard 120V outlet", price: 80, duration: 25 },
        { name: "GFCI Outlet", description: "Ground fault circuit interrupter outlet", price: 100, duration: 30 },
        { name: "240V Outlet", description: "Heavy-duty 240V outlet for appliances", price: 150, duration: 45 },
      ],
    },
    {
      name: "Panel Inspection",
      description: "Electrical panel safety inspection",
      duration: 45,
      price: 100,
      options: [
        { name: "Visual Inspection", description: "Panel visual safety check", price: 80, duration: 30 },
        { name: "Full Inspection", description: "Comprehensive panel testing", price: 100, duration: 45 },
        { name: "Inspection + Breaker Replacement", description: "Inspection with breaker swap", price: 160, duration: 60 },
      ],
    },
    {
      name: "Lighting Installation",
      description: "Install new light fixture or ceiling fan",
      duration: 60,
      price: 120,
      options: [
        { name: "Light Fixture", description: "Install standard light fixture", price: 100, duration: 45 },
        { name: "Ceiling Fan", description: "Install ceiling fan with light", price: 150, duration: 75 },
        { name: "Recessed Lighting", description: "Install recessed can light", price: 120, duration: 60 },
      ],
    },
    {
      name: "Wiring Repair",
      description: "Diagnose and repair electrical wiring issues",
      duration: 60,
      price: 130,
      options: [
        { name: "Troubleshooting", description: "Diagnose electrical issue", price: 100, duration: 45 },
        { name: "Wire Repair", description: "Repair damaged or faulty wiring", price: 130, duration: 60 },
        { name: "Circuit Addition", description: "Run new circuit from panel", price: 250, duration: 120 },
      ],
    },
  ],

  hvac: [
    {
      name: "AC Tune-Up",
      description: "Air conditioning maintenance and inspection",
      duration: 60,
      price: 100,
      options: [
        { name: "Basic Tune-Up", description: "Inspect, clean, and test AC unit", price: 100, duration: 60 },
        { name: "Tune-Up + Refrigerant", description: "Tune-up with refrigerant top-off", price: 175, duration: 75 },
      ],
    },
    {
      name: "Furnace Inspection",
      description: "Heating system safety check and tune-up",
      duration: 60,
      price: 100,
      options: [
        { name: "Safety Inspection", description: "CO and safety checks", price: 80, duration: 45 },
        { name: "Full Tune-Up", description: "Complete furnace maintenance", price: 100, duration: 60 },
        { name: "Tune-Up + Ignitor Replace", description: "Tune-up with ignitor replacement", price: 175, duration: 75 },
      ],
    },
    {
      name: "Filter Replacement",
      description: "Replace air filters and check airflow",
      duration: 30,
      price: 50,
      options: [
        { name: "Standard Filter", description: "Replace with standard pleated filter", price: 40, duration: 20 },
        { name: "HEPA Filter", description: "Replace with high-efficiency filter", price: 70, duration: 25 },
      ],
    },
    {
      name: "Duct Cleaning",
      description: "Professional air duct cleaning service",
      duration: 120,
      price: 250,
      options: [
        { name: "Standard Home", description: "Up to 10 vents", price: 250, duration: 120 },
        { name: "Large Home", description: "11-20 vents", price: 375, duration: 180 },
        { name: "Duct Cleaning + Sanitizing", description: "Clean and sanitize ducts", price: 350, duration: 150 },
      ],
    },
  ],

  cleaning: [
    {
      name: "Standard Cleaning",
      description: "Regular home cleaning service",
      duration: 120,
      price: 120,
      options: [
        { name: "1 Bedroom", description: "Studio or 1-bedroom home", price: 80, duration: 75 },
        { name: "2-3 Bedrooms", description: "Medium-sized home", price: 120, duration: 120 },
        { name: "4+ Bedrooms", description: "Large home", price: 175, duration: 180 },
      ],
    },
    {
      name: "Deep Cleaning",
      description: "Thorough deep clean of entire home",
      duration: 180,
      price: 220,
      options: [
        { name: "1 Bedroom", description: "Deep clean small home", price: 150, duration: 120 },
        { name: "2-3 Bedrooms", description: "Deep clean medium home", price: 220, duration: 180 },
        { name: "4+ Bedrooms", description: "Deep clean large home", price: 320, duration: 240 },
      ],
    },
    {
      name: "Move-In/Move-Out Clean",
      description: "Complete cleaning for move transitions",
      duration: 180,
      price: 250,
      options: [
        { name: "Apartment", description: "Apartment move clean", price: 200, duration: 150 },
        { name: "House", description: "Full house move clean", price: 300, duration: 210 },
        { name: "House + Garage", description: "House and garage cleaning", price: 375, duration: 270 },
      ],
    },
    {
      name: "Office Cleaning",
      description: "Commercial office space cleaning",
      duration: 120,
      price: 150,
      options: [
        { name: "Small Office", description: "Up to 1,000 sq ft", price: 100, duration: 60 },
        { name: "Medium Office", description: "1,000-3,000 sq ft", price: 150, duration: 120 },
        { name: "Large Office", description: "3,000+ sq ft", price: 250, duration: 180 },
      ],
    },
  ],

  landscaping: [
    {
      name: "Lawn Mowing",
      description: "Standard lawn mowing and edging",
      duration: 60,
      price: 50,
      options: [
        { name: "Small Yard", description: "Under 5,000 sq ft", price: 35, duration: 30 },
        { name: "Medium Yard", description: "5,000-10,000 sq ft", price: 50, duration: 45 },
        { name: "Large Yard", description: "Over 10,000 sq ft", price: 80, duration: 75 },
      ],
    },
    {
      name: "Garden Maintenance",
      description: "Weeding, pruning, and garden care",
      duration: 90,
      price: 80,
      options: [
        { name: "Weeding Only", description: "Weed removal from beds", price: 50, duration: 45 },
        { name: "Weeding + Pruning", description: "Weeding and shrub pruning", price: 80, duration: 90 },
        { name: "Full Garden Care", description: "Weeding, pruning, mulching, and feeding", price: 130, duration: 120 },
      ],
    },
    {
      name: "Tree Trimming",
      description: "Professional tree and shrub trimming",
      duration: 120,
      price: 150,
      options: [
        { name: "Small Trees", description: "Trees under 15 feet", price: 100, duration: 60 },
        { name: "Medium Trees", description: "Trees 15-30 feet", price: 150, duration: 120 },
        { name: "Large Trees", description: "Trees over 30 feet", price: 300, duration: 180 },
      ],
    },
    {
      name: "Landscape Design Consultation",
      description: "Custom landscape design planning",
      duration: 60,
      price: 100,
      options: [
        { name: "Basic Plan", description: "Concept sketch and plant list", price: 100, duration: 60 },
        { name: "Detailed Plan", description: "Full design with 3D rendering", price: 250, duration: 120 },
      ],
    },
  ],

  roofing: [
    {
      name: "Roof Inspection",
      description: "Comprehensive roof condition assessment",
      duration: 60,
      price: 0,
      options: [
        { name: "Visual Inspection", description: "Ground and ladder inspection", price: 0, duration: 30 },
        { name: "Drone Inspection", description: "Aerial drone roof survey", price: 100, duration: 45 },
        { name: "Full Report", description: "Detailed written report with photos", price: 150, duration: 60 },
      ],
    },
    {
      name: "Leak Repair",
      description: "Locate and patch roof leaks",
      duration: 120,
      price: 200,
      options: [
        { name: "Minor Patch", description: "Small area sealant repair", price: 150, duration: 60 },
        { name: "Section Repair", description: "Replace damaged section", price: 300, duration: 120 },
        { name: "Flashing Repair", description: "Repair or replace flashing", price: 250, duration: 90 },
      ],
    },
    {
      name: "Gutter Cleaning",
      description: "Clean and flush gutter system",
      duration: 60,
      price: 100,
      options: [
        { name: "Single Story", description: "Clean gutters on one-story home", price: 80, duration: 45 },
        { name: "Two Story", description: "Clean gutters on two-story home", price: 120, duration: 75 },
        { name: "Clean + Guard Install", description: "Clean and install gutter guards", price: 250, duration: 120 },
      ],
    },
    {
      name: "Shingle Replacement",
      description: "Replace damaged or missing shingles",
      duration: 120,
      price: 250,
      options: [
        { name: "Small Repair", description: "Replace up to 10 shingles", price: 200, duration: 60 },
        { name: "Medium Repair", description: "Replace 10-25 shingles", price: 350, duration: 120 },
        { name: "Full Section", description: "Replace entire roof section", price: 600, duration: 240 },
      ],
    },
  ],

  // ──────────────────────────────────────
  // Food & Beverage
  // ──────────────────────────────────────
  restaurant: [
    {
      name: "Table Reservation",
      description: "Reserve a table for dining",
      duration: 90,
      price: 0,
      options: [
        { name: "2 Guests", description: "Table for two", price: 0, duration: 60 },
        { name: "4-6 Guests", description: "Table for a small group", price: 0, duration: 90 },
        { name: "7+ Guests", description: "Large party seating", price: 0, duration: 120 },
      ],
    },
    {
      name: "Private Dining",
      description: "Private dining room reservation",
      duration: 120,
      price: 200,
      options: [
        { name: "Small Room", description: "Private room for up to 10 guests", price: 200, duration: 120 },
        { name: "Large Room", description: "Private room for up to 30 guests", price: 400, duration: 150 },
        { name: "Full Buyout", description: "Exclusive use of entire space", price: 1000, duration: 180 },
      ],
    },
    {
      name: "Catering Consultation",
      description: "Plan a catered event menu",
      duration: 30,
      price: 0,
      options: [
        { name: "Phone Consultation", description: "Quick phone menu planning", price: 0, duration: 15 },
        { name: "In-Person Consultation", description: "Meet to discuss menu and logistics", price: 0, duration: 30 },
      ],
    },
  ],

  bakery: [
    {
      name: "Custom Cake Order",
      description: "Design and order a custom cake",
      duration: 30,
      price: 50,
      options: [
        { name: "Small Cake", description: "6-inch round, serves 8-10", price: 40, duration: 20 },
        { name: "Medium Cake", description: "8-inch round, serves 14-18", price: 55, duration: 25 },
        { name: "Large Cake", description: "10-inch round, serves 24-30", price: 75, duration: 30 },
        { name: "Tiered Cake", description: "Multi-tier custom design", price: 150, duration: 45 },
      ],
    },
    {
      name: "Wedding Cake Consultation",
      description: "Wedding cake tasting and design session",
      duration: 60,
      price: 0,
      options: [
        { name: "Basic Tasting", description: "Sample 3 flavors and discuss design", price: 0, duration: 45 },
        { name: "Full Tasting", description: "Sample 6 flavors with detailed design review", price: 25, duration: 60 },
      ],
    },
    {
      name: "Party Platter",
      description: "Assorted pastry platter for events",
      duration: 15,
      price: 40,
      options: [
        { name: "Small Platter", description: "Serves 8-12 people", price: 30, duration: 10 },
        { name: "Medium Platter", description: "Serves 15-20 people", price: 50, duration: 15 },
        { name: "Large Platter", description: "Serves 25-35 people", price: 75, duration: 20 },
      ],
    },
    {
      name: "Baking Class",
      description: "Hands-on baking workshop",
      duration: 120,
      price: 60,
      options: [
        { name: "Individual Class", description: "One-on-one instruction", price: 80, duration: 120 },
        { name: "Group Class", description: "Group workshop (up to 8)", price: 60, duration: 120 },
        { name: "Kids Class", description: "Fun baking class for ages 6-12", price: 40, duration: 90 },
      ],
    },
  ],

  catering: [
    {
      name: "Menu Consultation",
      description: "Custom menu planning for your event",
      duration: 45,
      price: 0,
      options: [
        { name: "Phone Planning", description: "Phone-based menu discussion", price: 0, duration: 20 },
        { name: "In-Person Meeting", description: "Meet to review menu options", price: 0, duration: 45 },
      ],
    },
    {
      name: "Small Event Catering",
      description: "Catering for up to 30 guests",
      duration: 180,
      price: 500,
      options: [
        { name: "Buffet Style", description: "Self-serve buffet setup", price: 450, duration: 150 },
        { name: "Plated Service", description: "Individually plated meals", price: 600, duration: 180 },
        { name: "Cocktail Reception", description: "Passed appetizers and drinks", price: 500, duration: 150 },
      ],
    },
    {
      name: "Large Event Catering",
      description: "Catering for 30-100 guests",
      duration: 240,
      price: 1200,
      options: [
        { name: "Buffet Style", description: "Full buffet for large group", price: 1000, duration: 210 },
        { name: "Plated Service", description: "Plated dinner service", price: 1500, duration: 240 },
        { name: "Food Station Style", description: "Multiple themed food stations", price: 1200, duration: 240 },
      ],
    },
    {
      name: "Tasting Session",
      description: "Sample dishes from your custom menu",
      duration: 60,
      price: 75,
      options: [
        { name: "Basic Tasting", description: "Sample 4-5 menu items", price: 50, duration: 45 },
        { name: "Full Tasting", description: "Sample 8-10 menu items with pairings", price: 100, duration: 75 },
      ],
    },
  ],

  food_truck: [
    {
      name: "Event Booking",
      description: "Book food truck for your event",
      duration: 180,
      price: 500,
      options: [
        { name: "2-Hour Event", description: "Serve for 2 hours", price: 400, duration: 120 },
        { name: "4-Hour Event", description: "Serve for 4 hours", price: 600, duration: 240 },
        { name: "Full Day Event", description: "All-day food service", price: 1000, duration: 480 },
      ],
    },
    {
      name: "Corporate Lunch",
      description: "On-site lunch service for offices",
      duration: 120,
      price: 400,
      options: [
        { name: "Small Office", description: "Serve up to 25 people", price: 300, duration: 90 },
        { name: "Medium Office", description: "Serve 25-50 people", price: 450, duration: 120 },
        { name: "Large Office", description: "Serve 50+ people", price: 700, duration: 150 },
      ],
    },
    {
      name: "Festival Booking",
      description: "Multi-day festival or fair booking",
      duration: 480,
      price: 1000,
      options: [
        { name: "Single Day", description: "One full day at festival", price: 800, duration: 480 },
        { name: "Weekend (2 Days)", description: "Two-day festival presence", price: 1400, duration: 480 },
        { name: "Full Event (3+ Days)", description: "Multi-day commitment", price: 2000, duration: 480 },
      ],
    },
  ],

  // ──────────────────────────────────────
  // Professional Services
  // ──────────────────────────────────────
  law_firm: [
    {
      name: "Initial Consultation",
      description: "Legal consultation to discuss your case",
      duration: 30,
      price: 0,
      options: [
        { name: "Phone Consultation", description: "Brief phone discussion", price: 0, duration: 15 },
        { name: "In-Person Consultation", description: "Face-to-face case review", price: 0, duration: 30 },
        { name: "Video Consultation", description: "Virtual meeting", price: 0, duration: 30 },
      ],
    },
    {
      name: "Document Review",
      description: "Review and analysis of legal documents",
      duration: 60,
      price: 200,
      options: [
        { name: "Simple Document", description: "Review a single straightforward document", price: 150, duration: 30 },
        { name: "Complex Document", description: "Detailed review of complex agreement", price: 250, duration: 60 },
        { name: "Document Package", description: "Review multiple related documents", price: 400, duration: 120 },
      ],
    },
    {
      name: "Contract Drafting",
      description: "Draft a standard business contract",
      duration: 90,
      price: 350,
      options: [
        { name: "Simple Contract", description: "Basic agreement or NDA", price: 250, duration: 60 },
        { name: "Standard Contract", description: "Business services or employment contract", price: 350, duration: 90 },
        { name: "Complex Contract", description: "Multi-party or specialized agreement", price: 600, duration: 150 },
      ],
    },
    {
      name: "Legal Representation",
      description: "Court appearance or legal proceeding",
      duration: 120,
      price: 500,
      options: [
        { name: "Administrative Hearing", description: "Represent at administrative proceeding", price: 400, duration: 90 },
        { name: "Court Appearance", description: "Represent at court hearing", price: 500, duration: 120 },
        { name: "Full Day Trial", description: "Full-day trial representation", price: 2000, duration: 480 },
      ],
    },
  ],

  accounting: [
    {
      name: "Tax Preparation",
      description: "Individual or small business tax filing",
      duration: 60,
      price: 150,
      options: [
        { name: "Simple Return", description: "W-2 income with standard deductions", price: 100, duration: 30 },
        { name: "Itemized Return", description: "Return with itemized deductions", price: 150, duration: 45 },
        { name: "Small Business Return", description: "Schedule C or partnership return", price: 300, duration: 90 },
      ],
    },
    {
      name: "Bookkeeping Consultation",
      description: "Review and organize financial records",
      duration: 45,
      price: 100,
      options: [
        { name: "Monthly Review", description: "Review one month of records", price: 75, duration: 30 },
        { name: "Quarterly Review", description: "Review one quarter of records", price: 150, duration: 60 },
        { name: "Annual Catch-Up", description: "Organize full year of records", price: 400, duration: 180 },
      ],
    },
    {
      name: "Financial Planning Session",
      description: "Personal financial planning and advice",
      duration: 60,
      price: 125,
      options: [
        { name: "Budgeting Session", description: "Create a personal budget plan", price: 100, duration: 45 },
        { name: "Retirement Planning", description: "Retirement savings strategy", price: 150, duration: 60 },
        { name: "Comprehensive Plan", description: "Full financial plan review", price: 250, duration: 90 },
      ],
    },
    {
      name: "Business Tax Strategy",
      description: "Tax strategy and optimization planning",
      duration: 90,
      price: 200,
      options: [
        { name: "Entity Selection", description: "Best business structure advice", price: 150, duration: 60 },
        { name: "Tax Optimization", description: "Deductions and credits strategy", price: 200, duration: 90 },
        { name: "Year-End Planning", description: "Year-end tax strategy session", price: 250, duration: 90 },
      ],
    },
  ],

  real_estate: [
    {
      name: "Buyer Consultation",
      description: "Home buying guidance and planning",
      duration: 45,
      price: 0,
      options: [
        { name: "First-Time Buyer", description: "Guidance for first-time home buyers", price: 0, duration: 60 },
        { name: "Investment Buyer", description: "Consultation for investment properties", price: 0, duration: 45 },
        { name: "Relocation Buyer", description: "Area overview for relocating buyers", price: 0, duration: 45 },
      ],
    },
    {
      name: "Property Showing",
      description: "Guided tour of a listed property",
      duration: 30,
      price: 0,
      options: [
        { name: "Single Property", description: "Tour one property", price: 0, duration: 30 },
        { name: "Multi-Property Tour", description: "Tour 2-4 properties in one trip", price: 0, duration: 120 },
      ],
    },
    {
      name: "Listing Consultation",
      description: "Home selling strategy and pricing review",
      duration: 60,
      price: 0,
      options: [
        { name: "Pricing Review", description: "Market-based pricing recommendation", price: 0, duration: 30 },
        { name: "Full Listing Strategy", description: "Pricing, staging, and marketing plan", price: 0, duration: 60 },
      ],
    },
    {
      name: "Market Analysis",
      description: "Comparative market analysis report",
      duration: 45,
      price: 0,
      options: [
        { name: "Basic CMA", description: "Quick comparable sales analysis", price: 0, duration: 30 },
        { name: "Detailed CMA", description: "Comprehensive market report with trends", price: 0, duration: 60 },
      ],
    },
  ],

  insurance: [
    {
      name: "Policy Review",
      description: "Review current coverage and identify gaps",
      duration: 30,
      price: 0,
      options: [
        { name: "Auto Policy", description: "Review auto insurance coverage", price: 0, duration: 20 },
        { name: "Home Policy", description: "Review homeowner insurance", price: 0, duration: 25 },
        { name: "Full Portfolio Review", description: "Review all insurance policies", price: 0, duration: 45 },
      ],
    },
    {
      name: "New Policy Consultation",
      description: "Explore insurance options for your needs",
      duration: 45,
      price: 0,
      options: [
        { name: "Auto Insurance", description: "Get auto insurance quotes", price: 0, duration: 30 },
        { name: "Home Insurance", description: "Get homeowner insurance quotes", price: 0, duration: 30 },
        { name: "Life Insurance", description: "Explore life insurance options", price: 0, duration: 45 },
        { name: "Business Insurance", description: "Commercial insurance options", price: 0, duration: 45 },
      ],
    },
    {
      name: "Claims Assistance",
      description: "Help filing and tracking an insurance claim",
      duration: 30,
      price: 0,
      options: [
        { name: "New Claim Filing", description: "Help file a new claim", price: 0, duration: 30 },
        { name: "Claim Follow-Up", description: "Follow up on existing claim status", price: 0, duration: 15 },
      ],
    },
    {
      name: "Annual Review",
      description: "Comprehensive annual coverage review",
      duration: 60,
      price: 0,
      options: [
        { name: "Personal Review", description: "Review all personal policies", price: 0, duration: 45 },
        { name: "Business Review", description: "Review all business policies", price: 0, duration: 60 },
      ],
    },
  ],

  consulting: [
    {
      name: "Discovery Call",
      description: "Initial call to understand your needs",
      duration: 30,
      price: 0,
      options: [
        { name: "Phone Call", description: "Quick phone discovery", price: 0, duration: 15 },
        { name: "Video Call", description: "Video meeting with screen share", price: 0, duration: 30 },
      ],
    },
    {
      name: "Strategy Session",
      description: "In-depth strategy and planning session",
      duration: 90,
      price: 200,
      options: [
        { name: "1-Hour Session", description: "Focused strategy discussion", price: 150, duration: 60 },
        { name: "Half-Day Session", description: "Deep-dive strategic planning", price: 400, duration: 240 },
        { name: "Full-Day Session", description: "Comprehensive strategic workshop", price: 700, duration: 480 },
      ],
    },
    {
      name: "Workshop",
      description: "Facilitated team workshop or training",
      duration: 180,
      price: 500,
      options: [
        { name: "Half-Day Workshop", description: "3-hour facilitated workshop", price: 500, duration: 180 },
        { name: "Full-Day Workshop", description: "6-hour intensive workshop", price: 900, duration: 360 },
        { name: "Multi-Day Program", description: "2-day training program", price: 1500, duration: 480 },
      ],
    },
    {
      name: "Follow-Up Session",
      description: "Progress review and next steps planning",
      duration: 45,
      price: 100,
      options: [
        { name: "Quick Check-In", description: "30-minute progress review", price: 75, duration: 30 },
        { name: "Full Review", description: "Detailed progress review and planning", price: 125, duration: 60 },
      ],
    },
  ],

  // ──────────────────────────────────────
  // Other
  // ──────────────────────────────────────
  pet_grooming: [
    {
      name: "Bath & Brush",
      description: "Full bath, brush, and blow-dry",
      duration: 45,
      price: 40,
      options: [
        { name: "Small Dog", description: "Dogs under 25 lbs", price: 30, duration: 30 },
        { name: "Medium Dog", description: "Dogs 25-50 lbs", price: 40, duration: 40 },
        { name: "Large Dog", description: "Dogs over 50 lbs", price: 55, duration: 55 },
        { name: "Cat Bath", description: "Feline bath and brush", price: 45, duration: 45 },
      ],
    },
    {
      name: "Full Groom",
      description: "Bath, haircut, nails, and ear cleaning",
      duration: 90,
      price: 65,
      options: [
        { name: "Small Dog", description: "Full groom for dogs under 25 lbs", price: 50, duration: 60 },
        { name: "Medium Dog", description: "Full groom for dogs 25-50 lbs", price: 65, duration: 75 },
        { name: "Large Dog", description: "Full groom for dogs over 50 lbs", price: 85, duration: 100 },
      ],
    },
    {
      name: "Nail Trim",
      description: "Quick nail trimming service",
      duration: 15,
      price: 15,
      options: [
        { name: "Dog Nail Trim", description: "Trim and file dog nails", price: 15, duration: 15 },
        { name: "Cat Nail Trim", description: "Trim cat nails", price: 12, duration: 10 },
        { name: "Nail Trim + Grinding", description: "Trim with smooth grind finish", price: 20, duration: 20 },
      ],
    },
    {
      name: "De-Shedding Treatment",
      description: "Specialized treatment to reduce shedding",
      duration: 60,
      price: 50,
      options: [
        { name: "Small Dog", description: "De-shed for dogs under 25 lbs", price: 40, duration: 40 },
        { name: "Medium Dog", description: "De-shed for dogs 25-50 lbs", price: 50, duration: 55 },
        { name: "Large Dog", description: "De-shed for dogs over 50 lbs", price: 70, duration: 75 },
      ],
    },
  ],

  photography: [
    {
      name: "Portrait Session",
      description: "Professional portrait photo session",
      duration: 60,
      price: 150,
      options: [
        { name: "Individual Portrait", description: "Solo portrait session", price: 120, duration: 45 },
        { name: "Couple Portrait", description: "Session for two people", price: 150, duration: 60 },
        { name: "Family Portrait", description: "Session for families", price: 200, duration: 75 },
      ],
    },
    {
      name: "Event Photography",
      description: "On-location event photo coverage",
      duration: 180,
      price: 400,
      options: [
        { name: "2-Hour Coverage", description: "Short event photo coverage", price: 300, duration: 120 },
        { name: "4-Hour Coverage", description: "Half-day event coverage", price: 500, duration: 240 },
        { name: "Full Day Coverage", description: "8-hour event coverage", price: 900, duration: 480 },
      ],
    },
    {
      name: "Headshot Session",
      description: "Professional headshot photos",
      duration: 30,
      price: 100,
      options: [
        { name: "Basic Headshot", description: "One look, 3 retouched images", price: 80, duration: 20 },
        { name: "Standard Headshot", description: "Two looks, 5 retouched images", price: 120, duration: 30 },
        { name: "Team Headshots", description: "Per-person rate for groups of 5+", price: 60, duration: 15 },
      ],
    },
    {
      name: "Photo Editing Package",
      description: "Professional editing and retouching",
      duration: 60,
      price: 75,
      options: [
        { name: "Basic Editing", description: "Color correction on up to 20 photos", price: 50, duration: 30 },
        { name: "Standard Editing", description: "Full edit on up to 40 photos", price: 75, duration: 60 },
        { name: "Advanced Retouching", description: "Detailed retouching up to 15 photos", price: 120, duration: 90 },
      ],
    },
  ],

  fitness: [
    {
      name: "Personal Training Session",
      description: "One-on-one personal training",
      duration: 60,
      price: 70,
      options: [
        { name: "30-Minute Session", description: "Quick focused workout", price: 40, duration: 30 },
        { name: "60-Minute Session", description: "Full personal training session", price: 70, duration: 60 },
        { name: "Partner Session", description: "Train with a partner (per person)", price: 50, duration: 60 },
      ],
    },
    {
      name: "Group Fitness Class",
      description: "Instructor-led group workout",
      duration: 45,
      price: 20,
      options: [
        { name: "HIIT Class", description: "High-intensity interval training", price: 20, duration: 45 },
        { name: "Yoga Class", description: "Yoga flow session", price: 20, duration: 60 },
        { name: "Spin Class", description: "Indoor cycling class", price: 22, duration: 45 },
        { name: "Strength Class", description: "Weight training group class", price: 20, duration: 50 },
      ],
    },
    {
      name: "Fitness Assessment",
      description: "Body composition and fitness evaluation",
      duration: 30,
      price: 50,
      options: [
        { name: "Basic Assessment", description: "Body measurements and basic tests", price: 35, duration: 20 },
        { name: "Full Assessment", description: "Body comp, strength, and cardio testing", price: 50, duration: 30 },
        { name: "Assessment + Plan", description: "Full assessment with custom workout plan", price: 80, duration: 45 },
      ],
    },
    {
      name: "Nutrition Consultation",
      description: "Personalized meal planning session",
      duration: 45,
      price: 60,
      options: [
        { name: "Initial Consultation", description: "Assess goals and create meal plan", price: 60, duration: 45 },
        { name: "Follow-Up", description: "Review progress and adjust plan", price: 40, duration: 30 },
        { name: "Meal Prep Workshop", description: "Hands-on meal prep guidance", price: 80, duration: 60 },
      ],
    },
  ],

  tutoring: [
    {
      name: "Tutoring Session",
      description: "One-on-one subject tutoring",
      duration: 60,
      price: 50,
      options: [
        { name: "30-Minute Session", description: "Quick focused lesson", price: 30, duration: 30 },
        { name: "60-Minute Session", description: "Standard tutoring session", price: 50, duration: 60 },
        { name: "90-Minute Session", description: "Extended deep-dive session", price: 70, duration: 90 },
      ],
    },
    {
      name: "Test Prep Session",
      description: "Focused standardized test preparation",
      duration: 90,
      price: 70,
      options: [
        { name: "SAT Prep", description: "SAT-focused preparation", price: 70, duration: 90 },
        { name: "ACT Prep", description: "ACT-focused preparation", price: 70, duration: 90 },
        { name: "GRE / GMAT Prep", description: "Graduate-level test prep", price: 85, duration: 90 },
      ],
    },
    {
      name: "Homework Help",
      description: "Guided homework assistance",
      duration: 45,
      price: 35,
      options: [
        { name: "Elementary Level", description: "K-5 homework support", price: 30, duration: 30 },
        { name: "Middle School Level", description: "Grades 6-8 homework support", price: 35, duration: 45 },
        { name: "High School Level", description: "Grades 9-12 homework support", price: 40, duration: 45 },
      ],
    },
    {
      name: "Study Skills Workshop",
      description: "Learn effective study techniques",
      duration: 60,
      price: 40,
      options: [
        { name: "Individual Workshop", description: "One-on-one study skills coaching", price: 40, duration: 60 },
        { name: "Group Workshop", description: "Small group study skills session", price: 25, duration: 60 },
      ],
    },
  ],
};

export function getSampleServicesForIndustry(industry: string): SampleService[] {
  return INDUSTRY_SAMPLE_SERVICES[industry] ?? DEFAULT_SAMPLE_SERVICES;
}
