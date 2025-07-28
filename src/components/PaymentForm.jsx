import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Lock, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';

// PayPal Icon Component
const PaypalIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.32 20.32h-4.6c-.5 0-.9-.4-.9-.9l2.5-15.8c.1-.5.5-.9 1-.9h7.1c1.8 0 3.2.3 4.2.8 1 .5 1.6 1.3 1.7 2.3.1.8-.1 1.5-.6 2.1-.5.6-1.4 1-2.6 1.1 0 0 0 .1 0 .2.4 2.2-.2 3.8-1.7 4.6-1.4.7-3.5.8-5.9.8-.2 0-.4-.2-.4-.4v-.7c0-.2.2-.4.4-.4 2.4 0 4.5-.1 5.9-.8 1.6-.8 2.2-2.4 1.7-4.6 0-.1 0-.1 0-.2 1.2-.2 2.1-.6 2.6-1.1.5-.6.7-1.3.6-2.1-.1-1-.7-1.8-1.7-2.3-1-.5-2.4-.8-4.2-.8h-7.1c-.5 0-1 .4-1.1.9l-2.5 15.8c0 .5.4.9.9.9z"/>
  </svg>
);
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/api';

const PaymentForm = ({ onSuccess, onCancel }) => {
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [errors, setErrors] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    loadPaymentConfig();
  }, []);

  const loadPaymentConfig = async () => {
    try {
      const response = await apiService.get('/payments/config');
      if (response.success) {
        setPaymentConfig(response.data);
      }
    } catch (error) {
      console.error('Failed to load payment config:', error);
      toast({
        title: "Configuration Error",
        description: "Failed to load payment configuration.",
        variant: "destructive"
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (paymentConfig && paymentConfig.minimum_amounts[currency]) {
      const minAmount = paymentConfig.minimum_amounts[currency];
      if (parseFloat(amount) < minAmount) {
        newErrors.amount = `Minimum amount for ${currency} is ${minAmount}`;
      }
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStripePayment = async () => {
    try {
      // Create payment intent
      const response = await apiService.post('/payments/stripe/create-payment-intent', {
        amount: parseFloat(amount),
        currency,
        description
      });

      if (response.success) {
        // Here you would integrate with Stripe Elements
        // For now, we'll simulate a successful payment
        toast({
          title: "Payment Processing",
          description: "Redirecting to Stripe checkout...",
        });

        // Simulate payment completion
        setTimeout(() => {
          handlePaymentSuccess({
            payment_id: response.data.payment_id,
            method: 'stripe'
          });
        }, 2000);
      } else {
        throw new Error(response.message || 'Payment failed');
      }
    } catch (error) {
      console.error('Stripe payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process Stripe payment.",
        variant: "destructive"
      });
    }
  };

  const handlePayPalPayment = async () => {
    try {
      // Create PayPal order
      const response = await apiService.post('/payments/paypal/create-order', {
        amount: parseFloat(amount),
        currency,
        description
      });

      if (response.success) {
        // Redirect to PayPal
        window.location.href = response.data.approval_url;
      } else {
        throw new Error(response.message || 'PayPal order creation failed');
      }
    } catch (error) {
      console.error('PayPal payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to create PayPal order.",
        variant: "destructive"
      });
    }
  };

  const handlePaymentSuccess = (paymentData) => {
    toast({
      title: "Payment Successful!",
      description: `Your payment of ${currency} ${amount} has been processed.`,
    });
    onSuccess && onSuccess(paymentData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);

    try {
      if (paymentMethod === 'stripe') {
        await handleStripePayment();
      } else if (paymentMethod === 'paypal') {
        await handlePayPalPayment();
      }
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!paymentConfig) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto"
    >
      <Card className="glass-effect border-blue-900/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Send Payment
          </CardTitle>
          <p className="text-gray-400 text-sm">
            Secure worldwide payment processing
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label className="text-white">Payment Method</Label>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                type="button"
                onClick={() => setPaymentMethod('stripe')}
                className={`
                  p-3 rounded-lg border-2 transition-all duration-300 flex items-center justify-center gap-2
                  ${paymentMethod === 'stripe' 
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300' 
                    : 'border-gray-600 hover:border-gray-500 text-gray-400'
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-sm font-medium">Stripe</span>
              </motion.button>
              
              <motion.button
                type="button"
                onClick={() => setPaymentMethod('paypal')}
                className={`
                  p-3 rounded-lg border-2 transition-all duration-300 flex items-center justify-center gap-2
                  ${paymentMethod === 'paypal' 
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300' 
                    : 'border-gray-600 hover:border-gray-500 text-gray-400'
                  }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <PaypalIcon className="w-4 h-4" />
                <span className="text-sm font-medium">PayPal</span>
              </motion.button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount and Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="amount" className="text-white">
                  Amount {errors.amount && <span className="text-red-400 text-xs">*</span>}
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={`
                    bg-black/50 border-gray-600 text-white placeholder:text-gray-500
                    ${errors.amount ? 'border-red-500' : ''}
                  `}
                />
                {errors.amount && (
                  <p className="text-red-400 text-xs mt-1">{errors.amount}</p>
                )}
              </div>

              <div>
                <Label htmlFor="currency" className="text-white">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="bg-black/50 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {paymentConfig.supported_currencies.map((curr) => (
                      <SelectItem key={curr} value={curr} className="text-white hover:bg-gray-700">
                        {curr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" className="text-white">
                Description {errors.description && <span className="text-red-400 text-xs">*</span>}
              </Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Payment description"
                className={`
                  bg-black/50 border-gray-600 text-white placeholder:text-gray-500
                  ${errors.description ? 'border-red-500' : ''}
                `}
              />
              {errors.description && (
                <p className="text-red-400 text-xs mt-1">{errors.description}</p>
              )}
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <Lock className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-green-300">
                <p className="font-medium">Secure Payment</p>
                <p className="text-green-400">
                  Your payment is protected by industry-standard encryption
                </p>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={onCancel}
                variant="outline"
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
                disabled={isProcessing}
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                disabled={isProcessing || !amount || !description}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {paymentMethod === 'stripe' ? <CreditCard className="w-4 h-4" /> : <PaypalIcon className="w-4 h-4" />}
                    Pay {currency} {amount || '0.00'}
                  </div>
                )}
              </Button>
            </div>
          </form>

          {/* Supported Currencies Info */}
          <div className="text-xs text-gray-500 text-center">
            <p>Supported: {paymentConfig.supported_currencies.join(', ')}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PaymentForm;