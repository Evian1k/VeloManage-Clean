import express from 'express';
import Stripe from 'stripe';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// @route   POST /api/v1/payments/create-payment-intent
// @desc    Create a payment intent for Stripe
// @access  Private
router.post('/create-payment-intent', [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { amount, currency = 'usd', description = 'AutoCare Pro Service Payment' } = req.body;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      description,
      metadata: {
        userId: req.user._id.toString(),
        userName: req.user.name,
        userEmail: req.user.email
      }
    });

    // Broadcast payment attempt to admins
    const io = req.app.get('socketio');
    io.to('admin-room').emit('payment-initiated', {
      userId: req.user._id,
      userName: req.user.name,
      amount: amount,
      currency,
      paymentIntentId: paymentIntent.id,
      timestamp: new Date()
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });

  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment intent'
    });
  }
});

// @route   POST /api/v1/payments/confirm-payment
// @desc    Confirm payment completion
// @access  Private
router.post('/confirm-payment', [
  body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { paymentIntentId } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Broadcast successful payment to admins
      const io = req.app.get('socketio');
      io.to('admin-room').emit('payment-completed', {
        userId: req.user._id,
        userName: req.user.name,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        paymentIntentId: paymentIntent.id,
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment not completed',
        status: paymentIntent.status
      });
    }

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming payment'
    });
  }
});

// @route   GET /api/v1/payments/config
// @desc    Get payment configuration (publishable key)
// @access  Private
router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    }
  });
});

// @route   POST /api/v1/payments/webhook
// @desc    Handle Stripe webhooks
// @access  Public (but verified by Stripe signature)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('💰 Payment succeeded:', paymentIntent.id);
      
      // Broadcast to admins
      const io = req.app.get('socketio');
      io.to('admin-room').emit('payment-webhook-confirmed', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
        timestamp: new Date()
      });
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('❌ Payment failed:', failedPayment.id);
      
      // Broadcast failure to admins
      const ioFail = req.app.get('socketio');
      ioFail.to('admin-room').emit('payment-failed', {
        paymentIntentId: failedPayment.id,
        amount: failedPayment.amount / 100,
        currency: failedPayment.currency,
        metadata: failedPayment.metadata,
        timestamp: new Date()
      });
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

export default router;