import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  make: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: Number,
    required: true,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  licensePlate: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  vin: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  engineSize: {
    type: String,
    trim: true
  },
  fuelType: {
    type: String,
    enum: ['gasoline', 'diesel', 'hybrid', 'electric', 'other'],
    default: 'gasoline'
  },
  transmission: {
    type: String,
    enum: ['manual', 'automatic', 'cvt'],
    default: 'automatic'
  },
  mileage: {
    type: Number,
    default: 0,
    min: 0
  },
  purchaseDate: {
    type: Date
  },
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    expiryDate: Date,
    coverageType: {
      type: String,
      enum: ['basic', 'comprehensive', 'third_party']
    }
  },
  registrationInfo: {
    registrationNumber: String,
    expiryDate: Date,
    registeredState: String
  },
  maintenanceHistory: [{
    serviceType: {
      type: String,
      required: true
    },
    description: String,
    cost: {
      type: Number,
      default: 0
    },
    mileageAtService: Number,
    serviceDate: {
      type: Date,
      required: true
    },
    serviceProvider: String,
    nextServiceDue: Date,
    notes: String
  }],
  upcomingMaintenance: [{
    serviceType: {
      type: String,
      required: true
    },
    dueDate: Date,
    dueMileage: Number,
    description: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  }],
  documents: [{
    type: {
      type: String,
      enum: ['registration', 'insurance', 'inspection', 'warranty', 'other'],
      required: true
    },
    filename: String,
    originalName: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    expiryDate: Date
  }],
  images: [{
    filename: String,
    originalName: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    description: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
vehicleSchema.index({ owner: 1 });
vehicleSchema.index({ licensePlate: 1 });
vehicleSchema.index({ make: 1, model: 1 });
vehicleSchema.index({ year: 1 });
vehicleSchema.index({ createdAt: -1 });

// Virtual for vehicle display name
vehicleSchema.virtual('displayName').get(function() {
  return `${this.year} ${this.make} ${this.model}`;
});

// Virtual for age
vehicleSchema.virtual('age').get(function() {
  return new Date().getFullYear() - this.year;
});

// Virtual for overdue maintenance
vehicleSchema.virtual('overdueMaintenance').get(function() {
  const now = new Date();
  return this.upcomingMaintenance.filter(maintenance => {
    return (maintenance.dueDate && maintenance.dueDate < now) ||
           (maintenance.dueMileage && this.mileage >= maintenance.dueMileage);
  });
});

// Method to add maintenance record
vehicleSchema.methods.addMaintenanceRecord = function(record) {
  this.maintenanceHistory.push({
    ...record,
    serviceDate: record.serviceDate || new Date()
  });
  
  // Update mileage if provided
  if (record.mileageAtService && record.mileageAtService > this.mileage) {
    this.mileage = record.mileageAtService;
  }
  
  return this.save();
};

// Method to update mileage
vehicleSchema.methods.updateMileage = function(newMileage) {
  if (newMileage > this.mileage) {
    this.mileage = newMileage;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to schedule maintenance
vehicleSchema.methods.scheduleMaintenance = function(maintenance) {
  this.upcomingMaintenance.push(maintenance);
  return this.save();
};

// Method to complete scheduled maintenance
vehicleSchema.methods.completeScheduledMaintenance = function(maintenanceId, serviceRecord) {
  // Remove from upcoming maintenance
  this.upcomingMaintenance = this.upcomingMaintenance.filter(
    m => m._id.toString() !== maintenanceId.toString()
  );
  
  // Add to maintenance history
  this.maintenanceHistory.push(serviceRecord);
  
  return this.save();
};

// Static method to get vehicles by owner
vehicleSchema.statics.getByOwner = function(ownerId) {
  return this.find({ owner: ownerId, isActive: true })
    .populate('owner', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to search vehicles
vehicleSchema.statics.search = function(query) {
  const searchRegex = new RegExp(query, 'i');
  return this.find({
    $or: [
      { make: searchRegex },
      { model: searchRegex },
      { licensePlate: searchRegex },
      { vin: searchRegex }
    ],
    isActive: true
  }).populate('owner', 'name email');
};

// Static method to get vehicles with overdue maintenance
vehicleSchema.statics.getOverdueMaintenance = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    $or: [
      { 'upcomingMaintenance.dueDate': { $lt: now } },
      { $expr: { $gte: ['$mileage', '$upcomingMaintenance.dueMileage'] } }
    ]
  }).populate('owner', 'name email phone');
};

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

export default Vehicle;