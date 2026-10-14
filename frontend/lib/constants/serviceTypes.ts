// Curated catalog of service types per skill. Add Skill uses this as a
// multi-select so residents pick real services instead of typing free text.
// The backend mirrors this list in backend/utils/serviceTypes.ts — keep both
// in sync when editing.

export const SKILL_SERVICE_TYPES: Record<string, string[]> = {
  Teaching: [
    "Tutoring",
    "Lesson Planning",
    "Review Sessions",
    "Exam Coaching",
    "Reading Tutorial",
  ],
  Barbering: [
    "Haircut",
    "Beard Trim",
    "Hair Shave",
    "Hair Coloring",
    "Scalp Massage",
  ],
  Cooking: [
    "Meal Preparation",
    "Catering",
    "Party Trays",
    "Packed Lunch",
    "Dessert Making",
  ],
  Farming: [
    "Crop Planting",
    "Vegetable Gardening",
    "Harvesting",
    "Livestock Raising",
    "Land Preparation",
  ],
  Caretaker: [
    "House Sitting",
    "Child Care",
    "Elderly Care",
    "Pet Care",
    "Babysitting",
  ],
  Plumbing: [
    "Pipe Repair",
    "Pipe Installation",
    "Faucet Repair",
    "Toilet Repair",
    "Drain Cleaning",
    "Water Tank Installation",
  ],
  Electrical: [
    "Wiring Installation",
    "Light Fixture Repair",
    "Outlet Repair",
    "Electrical Inspection",
    "Breaker Repair",
  ],
  Carpentry: [
    "Cabinet Repair",
    "Furniture Making",
    "Door Repair",
    "Table Making",
    "Chair Repair",
    "Wood Finishing",
  ],
  Tailoring: [
    "Clothing Alteration",
    "Dress Making",
    "Uniform Sewing",
    "Clothes Repair",
    "Curtain Making",
  ],
  Driving: [
    "Tricycle Driving",
    "Delivery Driving",
    "Airport Transfer",
    "School Service",
    "Van Rental",
  ],
  Welding: [
    "Gate Welding",
    "Window Fabrication",
    "Metal Repairs",
    "Steel Frame Fabrication",
    "Grill Making",
  ],
  Masonry: [
    "Concrete Work",
    "Wall Building",
    "Tile Setting",
    "Cement Mixing",
    "Fence Building",
  ],
  Painting: [
    "House Painting",
    "Wall Painting",
    "Furniture Painting",
    "Roof Painting",
    "Repainting",
  ],
  Baking: [
    "Bread Baking",
    "Cake Baking",
    "Pastry Making",
    "Cookies Baking",
    "Custom Cakes",
  ],
  Sewing: [
    "Clothes Sewing",
    "Embroidery",
    "Fabric Repair",
    "Bag Making",
    "Upholstery",
  ],
  "Computer Repair": [
    "Laptop Repair",
    "Desktop Repair",
    "Software Installation",
    "Virus Removal",
    "Printer Repair",
    "Data Recovery",
  ],
  Tutoring: [
    "Math Tutoring",
    "English Tutoring",
    "Science Tutoring",
    "Online Tutoring",
    "Review Sessions",
  ],
  Photography: [
    "Event Photography",
    "Portrait Photography",
    "Photo Editing",
    "Wedding Photography",
    "Product Photography",
  ],
  "Event Planning": [
    "Party Planning",
    "Wedding Coordination",
    "Birthday Planning",
    "Program Hosting",
    "Venue Decoration",
  ],
  "Nursing Assistance": [
    "Elderly Care",
    "Post-Surgery Care",
    "Vital Signs Monitoring",
    "Medication Assistance",
    "Wound Care",
  ],
};

// Fallback options shown when the resident enters a custom ("Other") skill.
export const GENERAL_SERVICE_TYPES: string[] = [
  "General Labor",
  "Cleaning",
  "Moving Help",
  "Repair",
  "Installation",
  "Maintenance",
  "Delivery",
  "Consultation",
];

export const PRESET_SKILLS = Object.keys(SKILL_SERVICE_TYPES);

export const OTHER_SKILL_VALUE = "__other__";

export const ALL_SERVICE_TYPES: string[] = Array.from(
  new Set([
    ...Object.values(SKILL_SERVICE_TYPES).flat(),
    ...GENERAL_SERVICE_TYPES,
  ])
);

export const serviceTypesForSkill = (skill: string): string[] =>
  SKILL_SERVICE_TYPES[skill] ?? GENERAL_SERVICE_TYPES;
