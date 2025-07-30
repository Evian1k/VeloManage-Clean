import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User.js';
import Vehicle from '../src/models/Vehicle.js';
import Service from '../src/models/Service.js';
import Truck from '../src/models/Truck.js';
import Branch from '../src/models/Branch.js';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/autocare-pro';

async function initializeDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create sample admin users
    console.log('👨‍💼 Creating admin users...');
    const adminEmails = [
      'emmanuel.evian@autocare.com',
      'ibrahim.mohamud@autocare.com',
      'joel.nganga@autocare.com',
      'patience.karanja@autocare.com',
      'joyrose.kinuthia@autocare.com'
    ];

    const adminPassword = process.env.ADMIN_PASSWORD || 'autocarpro12k@12k.wwc';

    for (const email of adminEmails) {
      const existingAdmin = await User.findOne({ email });
      if (!existingAdmin) {
        const adminData = User.getAdminByEmail(email);
        if (adminData) {
          const admin = new User({
            name: adminData.name,
            email: email,
            password: adminPassword,
            isAdmin: true,
            role: adminData.role,
            phone: '+1-555-0123'
          });
          await admin.save();
          console.log(`✅ Created admin: ${admin.name} (${email})`);
        }
      } else {
        console.log(`ℹ️ Admin already exists: ${email}`);
      }
    }

    // Create sample regular user
    console.log('👤 Creating sample regular user...');
    const existingUser = await User.findOne({ email: 'john.doe@example.com' });
    if (!existingUser) {
      const sampleUser = new User({
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        phone: '+1-555-0456',
        isAdmin: false,
        role: 'user'
      });
      await sampleUser.save();
      console.log('✅ Created sample user: john.doe@example.com (password: password123)');

      // Create sample vehicle for the user
      console.log('🚗 Creating sample vehicle...');
      const sampleVehicle = new Vehicle({
        owner: sampleUser._id,
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        licensePlate: 'ABC123',
        color: 'Silver',
        vin: '1HGBH41JXMN109186',
        mileage: 45000,
        fuelType: 'gasoline',
        transmission: 'automatic'
      });
      await sampleVehicle.save();
      console.log('✅ Created sample vehicle: 2020 Toyota Camry');

      // Create sample service request
      console.log('🔧 Creating sample service request...');
      const sampleService = new Service({
        user: sampleUser._id,
        vehicle: sampleVehicle._id,
        serviceType: 'oil_change',
        title: 'Regular Oil Change',
        description: 'Routine oil change and filter replacement',
        preferredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        location: {
          address: '123 Main St, Anytown, USA',
          coordinates: [-74.006, 40.7128] // NYC coordinates
        },
        urgency: 'medium',
        estimatedCost: 75
      });
      await sampleService.save();
      console.log('✅ Created sample service request');
    } else {
      console.log('ℹ️ Sample user already exists');
    }

    // Create sample branches
    console.log('🏢 Creating sample branches...');
    const branches = [
      {
        name: 'AutoCare Pro Downtown',
        code: 'AC-DT',
        location: {
          address: '456 Business Ave',
          city: 'Downtown',
          state: 'NY',
          zipCode: '10001',
          coordinates: {
            latitude: 40.7589,
            longitude: -74.0059
          }
        },
        contact: {
          phone: '+1-555-0789',
          email: 'downtown@autocare.com'
        },
        workingHours: {
          monday: { open: '08:00', close: '18:00', isOpen: true },
          tuesday: { open: '08:00', close: '18:00', isOpen: true },
          wednesday: { open: '08:00', close: '18:00', isOpen: true },
          thursday: { open: '08:00', close: '18:00', isOpen: true },
          friday: { open: '08:00', close: '18:00', isOpen: true },
          saturday: { open: '09:00', close: '16:00', isOpen: true },
          sunday: { open: '10:00', close: '14:00', isOpen: true }
        },
        services: ['maintenance', 'repair', 'inspection'],
        capacity: {
          maxTrucks: 30,
          serviceSlots: 8
        },
        isActive: true
      },
      {
        name: 'AutoCare Pro Uptown',
        code: 'AC-UP',
        location: {
          address: '789 Service Blvd',
          city: 'Uptown',
          state: 'NY',
          zipCode: '10002',
          coordinates: {
            latitude: 40.7831,
            longitude: -73.9665
          }
        },
        contact: {
          phone: '+1-555-0987',
          email: 'uptown@autocare.com'
        },
        workingHours: {
          monday: { open: '07:00', close: '19:00', isOpen: true },
          tuesday: { open: '07:00', close: '19:00', isOpen: true },
          wednesday: { open: '07:00', close: '19:00', isOpen: true },
          thursday: { open: '07:00', close: '19:00', isOpen: true },
          friday: { open: '07:00', close: '19:00', isOpen: true },
          saturday: { open: '08:00', close: '17:00', isOpen: true },
          sunday: { open: '09:00', close: '15:00', isOpen: true }
        },
        services: ['maintenance', 'repair', 'fuel', 'car_wash'],
        capacity: {
          maxTrucks: 25,
          serviceSlots: 6
        },
        isActive: true
      }
    ];

    for (const branchData of branches) {
      const existingBranch = await Branch.findOne({ code: branchData.code });
      if (!existingBranch) {
        const branch = new Branch(branchData);
        await branch.save();
        console.log(`✅ Created branch: ${branch.name} (${branch.code})`);
      } else {
        console.log(`ℹ️ Branch already exists: ${branchData.name}`);
      }
    }

    // Create sample trucks
    console.log('🚛 Creating sample trucks...');
    const trucks = [
      {
        truckId: 'TRK-001',
        driver: {
          name: 'John Smith',
          phone: '+1-555-1001',
          email: 'john.smith@autocare.com',
          licenseNumber: 'DL123456'
        },
        vehicle: {
          licensePlate: 'AC001',
          make: 'Ford',
          model: 'Transit',
          year: 2022,
          capacity: '3.5 Tons'
        },
        status: 'available',
        currentLocation: {
          latitude: 40.7128,
          longitude: -74.006,
          address: 'Downtown Service Area'
        },
        specifications: {
          fuelType: 'petrol',
          engineSize: '3.5L',
          transmission: 'automatic'
        }
      },
      {
        truckId: 'TRK-002',
        driver: {
          name: 'Jane Doe',
          phone: '+1-555-1002',
          email: 'jane.doe@autocare.com',
          licenseNumber: 'DL234567'
        },
        vehicle: {
          licensePlate: 'AC002',
          make: 'Mercedes',
          model: 'Sprinter',
          year: 2023,
          capacity: '3.0 Tons'
        },
        status: 'available',
        currentLocation: {
          latitude: 40.7831,
          longitude: -73.9665,
          address: 'Uptown Service Area'
        },
        specifications: {
          fuelType: 'diesel',
          engineSize: '2.1L',
          transmission: 'automatic'
        }
      }
    ];

    for (const truckData of trucks) {
      const existingTruck = await Truck.findOne({ truckId: truckData.truckId });
      if (!existingTruck) {
        const truck = new Truck(truckData);
        await truck.save();
        console.log(`✅ Created truck: ${truck.truckId} (${truck.vehicle.make} ${truck.vehicle.model})`);
      } else {
        console.log(`ℹ️ Truck already exists: ${truckData.truckId}`);
      }
    }

    console.log('🎉 Database initialization completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`👨‍💼 Admin users: ${adminEmails.length}`);
    console.log('👤 Sample user: john.doe@example.com (password: password123)');
    console.log('🚗 Sample vehicle: 2020 Toyota Camry (ABC123)');
    console.log('🔧 Sample service request created');
    console.log(`🏢 Branches: ${branches.length}`);
    console.log(`🚛 Trucks: ${trucks.length}`);
    console.log('\n🔐 Admin login credentials:');
    console.log('Email: Any of the admin emails above');
    console.log(`Password: ${adminPassword}`);

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the initialization
initializeDatabase();