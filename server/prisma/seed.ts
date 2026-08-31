import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

  // 1. Seed Categories (Idempotent upsert)
  const categories = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }
  console.log("✔ Seeded 4 IT Request Categories.");

  // 2. Seed Related Systems (Idempotent upsert)
  const relatedSystems = [
    "Email",
    "Campus Wi-Fi",
    "VPN",
    "LEB2 App",
    "Grade Submission App",
    "Printer",
    "Corporate Laptop",
  ];

  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: { isActive: true },
      create: { name, isActive: true },
    });
  }
  console.log("✔ Seeded 7 Related Systems.");

  // 3. Seed Development Requesters (4 active, 1 inactive - Idempotent upsert by email)
  const requesters = [
    {
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      department: "Computer Engineering",
      isActive: true,
    },
    {
      name: "Michael Brown",
      email: "michael.brown@example.com",
      department: "Information Technology",
      isActive: true,
    },
    {
      name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      department: "Computer Science",
      isActive: true,
    },
    {
      name: "David Lee",
      email: "david.lee@example.com",
      department: "Digital Business",
      isActive: true,
    },
    {
      name: "Robert Smith (Inactive)",
      email: "robert.smith@example.com",
      department: "Administration",
      isActive: false, // Inactive user for boundary testing
    },
  ];

  for (const user of requesters) {
    await prisma.requesterUser.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        department: user.department,
        isActive: user.isActive,
      },
      create: user,
    });
  }
  console.log("✔ Seeded 5 Development Requesters (4 Active, 1 Inactive).");

  console.log("🎉 Database seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Database seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
