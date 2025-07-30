import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  serviceType: {
    type: String,
    required: true,
    enum: [
      'oil_change',
      'brake_service',
      'tire_rotation',
      'transmission_service',
      'engine_tune_up',
      'battery_replacement',
      'air_conditioning',
      'heating_system',
      'suspension_repair',
      'exhaust_system',
      'electrical_system',
      'cooling_system',
      'fuel_system',
      'emissions_test',
      'general_inspection',
      'other'
    ]
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  preferredDate: {
    type: Date,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    address: {
      type: String,
      required: true
    }
  },
  estimatedCost: {
    type: Number,
    default: 0
  },
  actualCost: {
    type: Number,
    default: 0
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedTruck: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck'
  },
  completedAt: {
    type: Date
  },
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: {
      type: String
    },
    ratedAt: {
      type: Date
    }
  },
  notes: [{
    text: {
      type: String,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tracking: {
    estimatedArrival: Date,
    actualArrival: Date,
    serviceStarted: Date,
    serviceCompleted: Date,
    departureTime: Date
  }
}, {
  timestamps: true
});

// Indexes for better performance
serviceSchema.index({ user: 1 });
serviceSchema.index({ status: 1 });
serviceSchema.index({ serviceType: 1 });
serviceSchema.index({ preferredDate: 1 });
serviceSchema.index({ createdAt: -1 });
serviceSchema.index({ 'location.coordinates': '2dsphere' });

// Virtual for formatted cost
serviceSchema.virtual('formattedCost').get(function() {
  return this.actualCost || this.estimatedCost;
});

// Virtual for service duration
serviceSchema.virtual('serviceDuration').get(function() {
  if (this.tracking.serviceStarted && this.tracking.serviceCompleted) {
    return this.tracking.serviceCompleted - this.tracking.serviceStarted;
  }
  return null;
});

// Method to check if service is overdue
serviceSchema.methods.isOverdue = function() {
  return this.status === 'pending' && new Date() > this.preferredDate;
};

// Method to add note
serviceSchema.methods.addNote = function(text, userId) {
  this.notes.push({
    text,
    createdBy: userId
  });
  return this.save();
};

// Static method to get services by status
serviceSchema.statics.getByStatus = function(status) {
  return this.find({ status })
    .populate('user', 'name email phone')
    .populate('vehicle', 'make model year licensePlate')
    .populate('assignedTo', 'name email')
    .populate('assignedTruck', 'truckNumber type')
    .sort({ createdAt: -1 });
};

// Static method to get user services
serviceSchema.statics.getUserServices = function(userId) {
  return this.find({ user: userId })
    .populate('vehicle', 'make model year licensePlate')
    .populate('assignedTo', 'name email')
    .populate('assignedTruck', 'truckNumber type')
    .sort({ createdAt: -1 });
};

const Service = mongoose.model('Service', serviceSchema);

export default Service;