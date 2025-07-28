import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    enum: ['NGN', 'USD', 'GHS', 'ZAR', 'KES'],
    default: 'NGN'
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['paystack', 'paypal', 'manual'],
    default: 'paystack'
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  // Paystack-specific fields
  paystackReference: {
    type: String,
    sparse: true
  },
  paystackTransactionId: {
    type: String,
    sparse: true
  },
  paystackStatus: {
    type: String,
    enum: ['pending', 'ongoing', 'success', 'failed', 'timeout', 'processing', 'abandoned']
  },
  // PayPal-specific fields
  paypalOrderId: {
    type: String,
    sparse: true
  },
  paypalCaptureId: {
    type: String
  },
  paypalPaymentStatus: {
    type: String
  },
  // Transaction metadata
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  completedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  refundAmount: {
    type: Number,
    min: 0
  },
  failureReason: {
    type: String
  },
  // Additional metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: {
      city: String,
      country: String
    },
    serviceType: {
      type: String,
      enum: ['car_service', 'truck_dispatch', 'general_payment', 'membership', 'other'],
      default: 'general_payment'
    },
    relatedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    }
  },
  isVisibleToAdmins: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Generate unique transaction ID before saving
paymentSchema.pre('save', async function(next) {
  if (!this.transactionId) {
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.transactionId = `AC${timestamp}${random}`;
  }
  next();
});

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = async function(startDate, endDate) {
  const matchStage = {
    status: 'completed',
    completedAt: {
      $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days default
      $lte: endDate || new Date()
    }
  };

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalTransactions: { $sum: 1 },
        averageAmount: { $avg: '$amount' },
        currencies: { $addToSet: '$currency' },
        paymentMethods: { $addToSet: '$paymentMethod' }
      }
    }
  ]);

  const currencyBreakdown = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$currency',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    overview: stats[0] || { totalAmount: 0, totalTransactions: 0, averageAmount: 0 },
    currencyBreakdown
  };
};

// Static method to get recent payments for admin dashboard
paymentSchema.statics.getRecentPayments = function(limit = 10) {
  return this.find({ isVisibleToAdmins: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email phone')
    .populate('metadata.relatedBooking', 'serviceType status');
};

// Instance method to process refund
paymentSchema.methods.processRefund = async function(refundAmount, reason) {
  if (this.status !== 'completed') {
    throw new Error('Can only refund completed payments');
  }

  if (refundAmount > this.amount) {
    throw new Error('Refund amount cannot exceed original payment amount');
  }

  this.status = 'refunded';
  this.refundAmount = refundAmount || this.amount;
  this.refundedAt = new Date();
  this.failureReason = reason;

  return this.save();
};

// Instance method to mark as failed
paymentSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failureReason = reason;
  return this.save();
};

// Indexes for better performance
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ currency: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ paystackReference: 1 });
paymentSchema.index({ paystackTransactionId: 1 });
paymentSchema.index({ paypalOrderId: 1 });
paymentSchema.index({ completedAt: -1 });
paymentSchema.index({ isVisibleToAdmins: 1 });
paymentSchema.index({ 'metadata.serviceType': 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;