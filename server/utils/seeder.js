/**
 * utils/seeder.js
 * -----------------------------------------------------------------------
 * Populates a fresh database with default categories, popular brands,
 * and an admin account so the app is usable immediately after setup.
 * Run with: npm run seed
 * -----------------------------------------------------------------------
 */

const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Brand = require('../models/Brand');
const Category = require('../models/Category');

const categories = [
  { name: { en: 'Luxury Cars', ar: 'سيارات فاخرة' }, type: 'car', icon: 'fa-gem', isFeatured: true, order: 1 },
  { name: { en: 'SUV', ar: 'دفع رباعي' }, type: 'car', icon: 'fa-truck-monster', isFeatured: true, order: 2 },
  { name: { en: 'Electric', ar: 'كهربائية' }, type: 'car', icon: 'fa-bolt', isFeatured: true, order: 3 },
  { name: { en: 'Sports', ar: 'رياضية' }, type: 'car', icon: 'fa-flag-checkered', isFeatured: true, order: 4 },
  { name: { en: 'Sedan', ar: 'سيدان' }, type: 'car', icon: 'fa-car', isFeatured: false, order: 5 },
  { name: { en: 'Pickup', ar: 'بيك أب' }, type: 'truck', icon: 'fa-truck-pickup', isFeatured: true, order: 6 },
  { name: { en: 'Heavy Truck', ar: 'شاحنة ثقيلة' }, type: 'truck', icon: 'fa-truck', isFeatured: false, order: 7 },
  { name: { en: 'Sport Bike', ar: 'دراجة رياضية' }, type: 'motorcycle', icon: 'fa-motorcycle', isFeatured: true, order: 8 },
  { name: { en: 'Cruiser', ar: 'كروزر' }, type: 'motorcycle', icon: 'fa-motorcycle', isFeatured: false, order: 9 },
];

const brands = [
  { name: 'Mercedes-Benz', types: ['car', 'truck'], isPopular: true },
  { name: 'BMW', types: ['car', 'motorcycle'], isPopular: true },
  { name: 'Toyota', types: ['car'], isPopular: true },
  { name: 'Honda', types: ['car', 'motorcycle'], isPopular: true },
  { name: 'Ford', types: ['car', 'truck'], isPopular: true },
  { name: 'Chevrolet', types: ['car', 'truck'], isPopular: true },
  { name: 'Yamaha', types: ['motorcycle'], isPopular: true },
  { name: 'Kawasaki', types: ['motorcycle'], isPopular: false },
  { name: 'Volvo', types: ['truck'], isPopular: false },
  { name: 'Audi', types: ['car'], isPopular: true },
  { name: 'Hyundai', types: ['car'], isPopular: false },
  { name: 'Nissan', types: ['car'], isPopular: false },
];

async function seed() {
  await connectDB();

  console.log('🌱 Seeding categories...');
  await Category.deleteMany({});
  await Category.insertMany(categories);

  console.log('🌱 Seeding brands...');
  await Brand.deleteMany({});
  await Brand.insertMany(brands);

  console.log('🌱 Seeding admin user...');
  const existingAdmin = await User.findOne({ email: env.adminEmail });
  if (!existingAdmin) {
    await User.create({
      name: 'Admin',
      email: env.adminEmail,
      password: env.adminPassword,
      role: 'admin',
      isVerified: true,
    });
    console.log(`✅ Admin created — login with:`);
    console.log(`   Email:    ${env.adminEmail}`);
    console.log(`   Password: ${env.adminPassword}`);
  } else {
    console.log(`ℹ️  Admin already exists (${env.adminEmail}) — skipped.`);
  }

  console.log('✅ Seeding complete!');
  await disconnectDB();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error('❌ Seeding failed:', err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
