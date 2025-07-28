import express from 'express';
import { body, validationResult } from 'express-validator';
import PayStack from 'paystack-api';
// Note: PayPal SDK has been deprecated, using REST API directly instead
// import paypal from '@paypal/paypal-server-sdk';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Initialize Paystack (only if API key is provided)
const paystack = process.env.PAYSTACK_SECRET_KEY ? PayStack(process.env.PAYSTACK_SECRET_KEY) : null;

// PayPal configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.paypal.com' 
  : 'https://api.sandbox.paypal.com';

// PayPal helper functions
async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  
  const data = await response.json();
  return data.access_token;
}

// @route   GET /api/v1/payments/config
// @desc    Get payment configuration
// @access  Private
router.get('/config', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      paystack_public_key: process.env.PAYSTACK_PUBLIC_KEY || null,
      paypal_client_id: process.env.PAYPAL_CLIENT_ID || null,
      paystack_enabled: !!process.env.PAYSTACK_SECRET_KEY,
      paypal_enabled: !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET),
      supported_currencies: ['NGN', 'USD', 'GHS', 'ZAR', 'KES'],
      minimum_amounts: {
        NGN: 100,
        USD: 1,
        GHS: 5,
        ZAR: 10,
        KES: 100
      }
    }
  });
});

// @route   POST /api/v1/payments/paystack/initialize
// @desc    Initialize Paystack transaction
// @access  Private
router.post('/paystack/initialize', authenticateToken, [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('currency').isIn(['NGN', 'USD', 'GHS', 'ZAR', 'KES']).withMessage('Invalid currency'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { amount, currency, description } = req.body;

    if (!paystack) {
      return res.status(503).json({
        success: false,
        message: 'Paystack payment processing is not configured. Please contact administrator.'
      });
    }

    // Create payment record first
    const payment = new Payment({
      user: req.user._id,
      amount,
      currency,
      description,
      paymentMethod: 'paystack',
      status: 'pending'
    });

    await payment.save();

    // Initialize Paystack transaction
    const transactionData = {
      amount: Math.round(amount * 100), // Convert to kobo/cents
      email: req.user.email,
      currency: currency.toUpperCase(),
      reference: payment._id.toString(),
      callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      metadata: {
        payment_id: payment._id.toString(),
        user_id: req.user._id.toString(),
        user_name: req.user.name,
        description: description || `Payment from ${req.user.name}`
      }
    };

    const response = await paystack.transaction.initialize(transactionData);

    if (response.status) {
      // Update payment with Paystack reference
      payment.paystackReference = response.data.reference;
      await payment.save();

      res.json({
        success: true,
        data: {
          authorization_url: response.data.authorization_url,
          access_code: response.data.access_code,
          reference: response.data.reference,
          payment_id: payment._id
        }
      });
    } else {
      throw new Error(response.message || 'Failed to initialize transaction');
    }

  } catch (error) {
    console.error('Paystack initialization error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error initializing payment'
    });
  }
});

// @route   POST /api/v1/payments/paystack/verify
// @desc    Verify Paystack payment
// @access  Private
router.post('/paystack/verify', authenticateToken, [
  body('reference').notEmpty().withMessage('Payment reference is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { reference } = req.body;

    if (!paystack) {
      return res.status(503).json({
        success: false,
        message: 'Paystack payment processing is not configured. Please contact administrator.'
      });
    }

    // Verify transaction with Paystack
    const response = await paystack.transaction.verify(reference);

    if (!response.status) {
      throw new Error(response.message || 'Transaction verification failed');
    }

    const transaction = response.data;

    // Find payment record
    const payment = await Payment.findById(transaction.metadata.payment_id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Update payment status
    payment.status = transaction.status === 'success' ? 'completed' : 'failed';
    payment.paystackTransactionId = transaction.id;
    payment.paystackStatus = transaction.status;
    
    if (transaction.status === 'success') {
      payment.completedAt = new Date();
    }

    await payment.save();

    // Notify admins via socket
    const io = req.app.get('socketio');
    if (transaction.status === 'success') {
      const eventData = {
        type: 'payment',
        paymentId: payment._id,
        userId: req.user._id,
        userName: req.user.name,
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description,
        timestamp: new Date(),
        message: `Paystack payment of ${payment.currency} ${payment.amount} received from ${req.user.name}`
      };

      io.to('admin-room').emit('payment-notification', eventData);
      io.emit('admin-submission-received', eventData);
    }

    res.json({
      success: true,
      data: {
        payment_status: transaction.status,
        payment_id: payment._id,
        amount: transaction.amount / 100, // Convert back from kobo/cents
        currency: transaction.currency
      }
    });

  } catch (error) {
    console.error('Paystack payment verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error verifying payment'
    });
  }
});

// @route   POST /api/v1/payments/paypal/create-order
// @desc    Create PayPal order
// @access  Private
router.post('/paypal/create-order', authenticateToken, [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('currency').isIn(['USD', 'EUR', 'GBP']).withMessage('Invalid currency for PayPal'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { amount, currency, description } = req.body;

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({
        success: false,
        message: 'PayPal payment processing is not configured. Please contact administrator.'
      });
    }

    // Create PayPal order using REST API
    const accessToken = await getPayPalAccessToken();
    
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toString()
        },
        description: description || `Payment from ${req.user.name}`
      }],
      application_context: {
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
      }
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(orderData)
    });

    const order = await response.json();

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      amount,
      currency,
      description,
      paymentMethod: 'paypal',
      paypalOrderId: order.id,
      status: 'pending'
    });

    await payment.save();

    res.json({
      success: true,
      data: {
        order_id: order.id,
        approval_url: order.links.find(link => link.rel === 'approve').href,
        payment_id: payment._id
      }
    });

  } catch (error) {
    console.error('PayPal order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating PayPal order'
    });
  }
});

// @route   POST /api/v1/payments/paypal/capture
// @desc    Capture PayPal payment
// @access  Private
router.post('/paypal/capture', authenticateToken, [
  body('order_id').notEmpty().withMessage('Order ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { order_id } = req.body;

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({
        success: false,
        message: 'PayPal payment processing is not configured. Please contact administrator.'
      });
    }

    // Capture PayPal payment using REST API
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const capture = await response.json();

    // Update payment record
    const payment = await Payment.findOne({ paypalOrderId: order_id });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    payment.status = capture.status === 'COMPLETED' ? 'completed' : 'failed';
    payment.paypalCaptureId = capture.purchase_units[0]?.payments?.captures?.[0]?.id;
    
    if (capture.status === 'COMPLETED') {
      payment.completedAt = new Date();
    }

    await payment.save();

    // Notify admins via socket
    const io = req.app.get('socketio');
    if (capture.status === 'COMPLETED') {
      const eventData = {
        type: 'payment',
        paymentId: payment._id,
        userId: req.user._id,
        userName: req.user.name,
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description,
        timestamp: new Date(),
        message: `PayPal payment of ${payment.currency} ${payment.amount} received from ${req.user.name}`
      };

      io.to('admin-room').emit('payment-notification', eventData);
      io.emit('admin-submission-received', eventData);
    }

    res.json({
      success: true,
      data: {
        capture_status: capture.status,
        payment_id: payment._id
      }
    });

  } catch (error) {
    console.error('PayPal payment capture error:', error);
    res.status(500).json({
      success: false,
      message: 'Error capturing PayPal payment'
    });
  }
});

// @route   GET /api/v1/payments
// @desc    Get user's payments
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('user', 'name email');

    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving payments'
    });
  }
});

// @route   GET /api/v1/payments/admin/all
// @desc    Get all payments (Admin only)
// @access  Admin
router.get('/admin/all', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdminUser()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const payments = await Payment.find()
      .sort({ createdAt: -1 })
      .populate('user', 'name email phone');

    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving payments'
    });
  }
});

export default router;