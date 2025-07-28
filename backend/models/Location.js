import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  coordinates: {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    }
  },
  address: {
    formatted: String,
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  type: {
    type: String,
    enum: ['home', 'work', 'service_location', 'pickup', 'delivery', 'emergency', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  isVisibleToAdmins: {
    type: Boolean,
    default: true
  },
  accuracy: {
    type: Number // GPS accuracy in meters
  },
  metadata: {
    source: {
      type: String,
      enum: ['gps', 'manual', 'geocoded'],
      default: 'manual'
    },
    deviceInfo: String,
    ipAddress: String,
    userAgent: String
  },
  relatedBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  relatedTruck: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck'
  }
}, {
  timestamps: true
});

// Create 2dsphere index for geospatial queries
locationSchema.index({ 
  'coordinates.latitude': 1, 
  'coordinates.longitude': 1 
});

// GeoJSON point for MongoDB geospatial queries
locationSchema.virtual('geoPoint').get(function() {
  return {
    type: 'Point',
    coordinates: [this.coordinates.longitude, this.coordinates.latitude]
  };
});

// Static method to find locations near a point
locationSchema.statics.findNearby = function(latitude, longitude, maxDistance = 10000) {
  return this.find({
    'coordinates.latitude': {
      $gte: latitude - (maxDistance / 111320), // Rough conversion: 1 degree = 111320 meters
      $lte: latitude + (maxDistance / 111320)
    },
    'coordinates.longitude': {
      $gte: longitude - (maxDistance / (111320 * Math.cos(latitude * Math.PI / 180))),
      $lte: longitude + (maxDistance / (111320 * Math.cos(latitude * Math.PI / 180)))
    },
    isActive: true
  }).populate('user', 'name email phone');
};

// Static method to get all admin-visible locations
locationSchema.statics.getAdminLocations = function() {
  return this.find({ isVisibleToAdmins: true, isActive: true })
    .populate('user', 'name email phone')
    .populate('relatedBooking', 'serviceType status')
    .populate('relatedTruck', 'truckNumber plateNumber')
    .sort({ createdAt: -1 });
};

// Static method to get user's location history
locationSchema.statics.getUserLocationHistory = function(userId, limit = 50) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Instance method to calculate distance to another location
locationSchema.methods.distanceTo = function(otherLocation) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (otherLocation.coordinates.latitude - this.coordinates.latitude) * Math.PI / 180;
  const dLon = (otherLocation.coordinates.longitude - this.coordinates.longitude) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.coordinates.latitude * Math.PI / 180) * 
    Math.cos(otherLocation.coordinates.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in kilometers
};

// Instance method to format for Google Maps
locationSchema.methods.toGoogleMapsFormat = function() {
  return {
    id: this._id,
    position: {
      lat: this.coordinates.latitude,
      lng: this.coordinates.longitude
    },
    title: this.name || `${this.user.name}'s Location`,
    description: this.description,
    type: this.type,
    address: this.address.formatted,
    user: {
      id: this.user._id,
      name: this.user.name,
      email: this.user.email
    },
    createdAt: this.createdAt
  };
};

// Pre-save middleware to ensure only one primary location per user per type
locationSchema.pre('save', async function(next) {
  if (this.isPrimary && this.isModified('isPrimary')) {
    // Remove primary flag from other locations of the same type for this user
    await this.constructor.updateMany(
      { 
        user: this.user, 
        type: this.type, 
        _id: { $ne: this._id },
        isPrimary: true 
      },
      { isPrimary: false }
    );
  }
  next();
});

// Indexes for better performance
locationSchema.index({ user: 1, createdAt: -1 });
locationSchema.index({ type: 1 });
locationSchema.index({ isActive: 1 });
locationSchema.index({ isPrimary: 1 });
locationSchema.index({ isVisibleToAdmins: 1 });
locationSchema.index({ createdAt: -1 });
locationSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

const Location = mongoose.model('Location', locationSchema);

export default Location;