import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create default categories (only Water and Electricity)
  const categories = [
    { name: 'Water', icon: '💧', color: '#06B6D4', isDefault: true },
    { name: 'Electricity', icon: '⚡', color: '#EAB308', isDefault: true },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }

  console.log(`✅ Created ${categories.length} default categories`);

  // Create default settings
  const defaultSettings = [
    { key: 'currency', value: 'RM' },
    { key: 'waterUnit', value: 'm³' },
    { key: 'electricityUnit', value: 'kWh' },
  ];

  for (const setting of defaultSettings) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ Created default settings');

  // Create a demo admin user (optional - comment out in production)
  const adminPassword = await bcrypt.hash('admin123', 12);
  
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@housefinance.local',
      password: adminPassword,
      displayName: 'Admin User',
      isAdmin: true,
    },
  });

  console.log('✅ Created demo admin user (username: admin, password: admin123)');
  console.log('⚠️  Remember to change the password in production!');

  console.log('🎉 Seeding completed!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
