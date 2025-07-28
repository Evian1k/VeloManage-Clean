import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for messages to all admins
  },
  conversation: {
    type: String,
    required: true // format: userId for user conversations, 'admin-broadcast' for admin messages
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  senderType: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  recipientType: {
    type: String,
    enum: ['user', 'admin', 'all_admins'],
    default: 'user'
  },
  isRead: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  isAutoReply: {
    type: Boolean,
    default: false
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    type: String
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
    location: {
      city: String,
      country: String
    }
  },
  isVisibleToAllAdmins: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Static method to send auto-reply
messageSchema.statics.sendAutoReply = async function(userId) {
  // Check if user has already received an auto-reply
  const existingAutoReply = await this.findOne({
    conversation: userId.toString(),
    isAutoReply: true
  });

  if (existingAutoReply) {
    return null; // Don't send another auto-reply
  }

  try {
    // Create auto-reply message
    const autoReply = new this({
      sender: null, // System message
      recipient: userId,
      conversation: userId.toString(),
      text: "Thanks for your message! An admin will review it shortly and get back to you.",
      senderType: 'admin',
      recipientType: 'user',
      isAutoReply: true,
      isRead: []
    });

    const savedAutoReply = await autoReply.save();
    console.log(`✅ Auto-reply sent to user ${userId}`);
    return savedAutoReply;
  } catch (error) {
    console.error('Error sending auto-reply:', error);
    return null;
  }
};

// Static method to get conversation between user and admin
messageSchema.statics.getConversation = function(userId, limit = 50) {
  return this.find({
    $or: [
      { conversation: userId.toString() },
      { isVisibleToAllAdmins: true }
    ]
  })
  .populate('sender', 'name email role')
  .populate('recipient', 'name email role')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to get all user conversations for admin with messages visible to all admins
messageSchema.statics.getAllConversations = async function() {
  const conversations = await this.aggregate([
    {
      $match: {
        $or: [
          { conversation: { $ne: 'admin-broadcast' } },
          { isVisibleToAllAdmins: true }
        ]
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: '$conversation',
        lastMessage: { $first: '$$ROOT' },
        messageCount: { $sum: 1 },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$senderType', 'user'] }, { $eq: ['$isRead', []] }] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  // Populate user data
  await this.populate(conversations, {
    path: 'lastMessage.sender',
    model: 'User',
    select: 'name email phone'
  });

  return conversations;
};

// Static method to mark messages as read by a specific admin
messageSchema.statics.markAsReadByAdmin = function(conversationId, adminId) {
  return this.updateMany(
    { 
      conversation: conversationId,
      'isRead.user': { $ne: adminId }
    },
    { 
      $push: { 
        isRead: {
          user: adminId,
          readAt: new Date()
        }
      }
    }
  );
};

// Static method to get all admin submissions/messages for broadcasting
messageSchema.statics.getAllAdminSubmissions = function() {
  return this.find({
    $or: [
      { recipientType: 'all_admins' },
      { isVisibleToAllAdmins: true },
      { senderType: 'user' } // All user messages should be visible to admins
    ]
  })
  .populate('sender', 'name email role phone')
  .populate('recipient', 'name email role')
  .sort({ createdAt: -1 });
};

// Instance method to mark single message as read by admin
messageSchema.methods.markAsReadByAdmin = function(adminId) {
  if (!this.isRead.find(read => read.user.toString() === adminId.toString())) {
    this.isRead.push({
      user: adminId,
      readAt: new Date()
    });
    return this.save();
  }
  return Promise.resolve(this);
};

// Indexes for better performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ recipient: 1 });
messageSchema.index({ senderType: 1 });
messageSchema.index({ recipientType: 1 });
messageSchema.index({ isVisibleToAllAdmins: 1 });
messageSchema.index({ 'isRead.user': 1 });
messageSchema.index({ isAutoReply: 1 });
messageSchema.index({ createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;