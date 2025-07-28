import express from 'express';
import { body, validationResult } from 'express-validator';
import Stripe from 'stripe';
// Note: PayPal SDK has been deprecated, using REST API directly instead
// import paypal from '@paypal/paypal-server-sdk';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
      stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
      paypal_client_id: process.env.PAYPAL_CLIENT_ID,
      supported_currencies: ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR'],
      minimum_amounts: {
        USD: 1,
        EUR: 1,
        GBP: 1,
        KES: 100,
        NGN: 100,
        ZAR: 10
      }
    }
  });
});

// @route   POST /api/v1/payments/stripe/create-payment-intent
// @desc    Create Stripe payment intent
// @access  Private
router.post('/stripe/create-payment-intent', authenticateToken, [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR']).withMessage('Invalid currency'),
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

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      description: description || `Payment from ${req.user.name}`,
      metadata: {
        userId: req.user._id.toString(),
        userName: req.user.name,
        userEmail: req.user.email
      }
    });

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      amount,
      currency,
      description,
      paymentMethod: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending'
    });

    await payment.save();

    res.json({
      success: true,
      data: {
        client_secret: paymentIntent.client_secret,
        payment_id: payment._id
      }
    });

  } catch (error) {
    console.error('Stripe payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment intent'
    });
  }
});

// @route   POST /api/v1/payments/stripe/confirm
// @desc    Confirm Stripe payment
// @access  Private
router.post('/stripe/confirm', authenticateToken, [
  body('payment_intent_id').notEmpty().withMessage('Payment intent ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { payment_intent_id } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    // Update payment record
    const payment = await Payment.findOne({ stripePaymentIntentId: payment_intent_id });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    payment.status = paymentIntent.status === 'succeeded' ? 'completed' : 'failed';
    payment.stripePaymentIntentStatus = paymentIntent.status;
    
    if (paymentIntent.status === 'succeeded') {
      payment.completedAt = new Date();
    }

    await payment.save();

    // Notify admins via socket
    const io = req.app.get('socketio');
    if (paymentIntent.status === 'succeeded') {
      const eventData = {
        type: 'payment',
        paymentId: payment._id,
        userId: req.user._id,
        userName: req.user.name,
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description,
        timestamp: new Date(),
        message: `Payment of ${payment.currency} ${payment.amount} received from ${req.user.name}`
      };

      io.to('admin-room').emit('payment-notification', eventData);
      io.emit('admin-submission-received', eventData);
    }

    res.json({
      success: true,
      data: {
        payment_status: paymentIntent.status,
        payment_id: payment._id
      }
    });

  } catch (error) {
    console.error('Stripe payment confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming payment'
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