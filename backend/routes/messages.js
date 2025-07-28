import express from 'express';
import { body, validationResult } from 'express-validator';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/v1/messages
// @desc    Get user's messages or admin submissions
// @access  Private
router.get('/', async (req, res) => {
  try {
    let messages;
    
    if (req.user.isAdminUser()) {
      // Admin: Get all submissions and messages visible to admins
      if (req.query.userId) {
        // Get specific user conversation
        messages = await Message.getConversation(req.query.userId);
      } else {
        // Get all admin submissions
        messages = await Message.getAllAdminSubmissions();
      }
    } else {
      // User: Get their own conversation
      const conversationId = req.user._id.toString();
      messages = await Message.getConversation(conversationId);
    }

    res.json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving messages'
    });
  }
});

// @route   POST /api/v1/messages
// @desc    Send message
// @access  Private
router.post('/', [
  body('text').trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { text, recipientId } = req.body;
    const isAdmin = req.user.isAdminUser();
    
    // Determine conversation ID and recipient type
    let conversationId;
    let recipient = null;
    let recipientType = 'user';
    let isVisibleToAllAdmins = false;
    
    if (isAdmin && recipientId) {
      // Admin sending to specific user
      conversationId = recipientId;
      recipient = recipientId;
      recipientType = 'user';
    } else if (!isAdmin) {
      // User sending to admin - should be visible to ALL admins
      conversationId = req.user._id.toString();
      recipientType = 'all_admins';
      isVisibleToAllAdmins = true;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid message configuration'
      });
    }

    // Create message
    const message = new Message({
      sender: req.user._id,
      recipient,
      conversation: conversationId,
      text,
      senderType: isAdmin ? 'admin' : 'user',
      recipientType,
      isVisibleToAllAdmins,
      isRead: []
    });

    await message.save();

    // Populate sender information
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role');

    // Send auto-reply for first user message
    let autoReply = null;
    if (!isAdmin) {
      autoReply = await Message.sendAutoReply(req.user._id);
    }

    // Emit real-time notification to ALL ADMINS for user messages
    const io = req.app.get('socketio');
    const eventData = {
      messageId: message._id,
      text: message.text,
      senderType: message.senderType,
      senderName: req.user.name,
      senderId: req.user._id,
      timestamp: message.createdAt,
      conversationId,
      recipientType,
      message: populatedMessage
    };

    if (isAdmin && recipientId) {
      // Admin sending to specific user
      io.to(`user-${recipientId}`).emit('message-received', eventData);
      console.log(`📨 Admin message sent to user ${recipientId}`);
    } else if (!isAdmin) {
      // User sending to ALL admins - broadcast to admin room
      io.to('admin-room').emit('message-received', eventData);
      io.emit('admin-submission-received', eventData); // Also emit global event
      console.log(`📨 User message broadcast to ALL admins from ${req.user.name}`);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: populatedMessage,
      autoReply: autoReply
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message'
    });
  }
});

// @route   GET /api/v1/messages/conversations
// @desc    Get all conversations (Admin only)
// @access  Admin
router.get('/conversations', requireAdmin, async (req, res) => {
  try {
    const conversations = await Message.getAllConversations();

    res.json({
      success: true,
      data: conversations
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving conversations'
    });
  }
});

// @route   GET /api/v1/messages/admin-submissions
// @desc    Get all submissions visible to admins (Admin only)
// @access  Admin
router.get('/admin-submissions', requireAdmin, async (req, res) => {
  try {
    const submissions = await Message.getAllAdminSubmissions();

    res.json({
      success: true,
      data: submissions,
      message: 'All admin submissions retrieved successfully'
    });

  } catch (error) {
    console.error('Get admin submissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving admin submissions'
    });
  }
});

// @route   PUT /api/v1/messages/read/:conversationId
// @desc    Mark messages as read by admin
// @access  Private
router.put('/read/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    if (req.user.isAdminUser()) {
      // Admin marking messages as read
      await Message.markAsReadByAdmin(conversationId, req.user._id);
    } else {
      // User - mark admin messages as read (legacy support)
      await Message.markAsReadByAdmin(conversationId, req.user._id);
    }

    res.json({
      success: true,
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking messages as read'
    });
  }
});

// @route   POST /api/v1/messages/broadcast
// @desc    Broadcast message to all admins (System/Admin only)
// @access  Admin
router.post('/broadcast', requireAdmin, [
  body('text').trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters'),
  body('title').optional().trim().isLength({ max: 100 }).withMessage('Title must be less than 100 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { text, title } = req.body;

    // Create broadcast message
    const message = new Message({
      sender: req.user._id,
      recipient: null, // No specific recipient
      conversation: 'admin-broadcast',
      text: title ? `${title}: ${text}` : text,
      senderType: 'admin',
      recipientType: 'all_admins',
      isVisibleToAllAdmins: true,
      isRead: []
    });

    await message.save();

    // Populate sender information
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email role');

    // Emit real-time notification to ALL admins
    const io = req.app.get('socketio');
    const eventData = {
      messageId: message._id,
      text: message.text,
      senderType: message.senderType,
      senderName: req.user.name,
      senderId: req.user._id,
      timestamp: message.createdAt,
      recipientType: 'all_admins',
      message: populatedMessage,
      isBroadcast: true
    };

    io.to('admin-room').emit('admin-broadcast-received', eventData);
    io.emit('admin-submission-received', eventData);

    console.log(`📢 Admin broadcast sent by ${req.user.name}`);

    res.status(201).json({
      success: true,
      message: 'Broadcast sent to all admins successfully',
      data: populatedMessage
    });

  } catch (error) {
    console.error('Broadcast message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending broadcast message'
    });
  }
});

export default router;