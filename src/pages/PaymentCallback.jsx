import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiService } from '@/services/api';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verificationStatus, setVerificationStatus] = useState('verifying');
  const [paymentData, setPaymentData] = useState(null);

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');
    
    // Use the reference from URL params
    const paymentReference = reference || trxref;
    
    if (!paymentReference) {
      setVerificationStatus('error');
      toast({
        title: "Payment Error",
        description: "Invalid payment reference.",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await apiService.verifyPaystackPayment(paymentReference);
      
      if (response.success) {
        setVerificationStatus('success');
        setPaymentData(response.data);
        toast({
          title: "Payment Successful!",
          description: `Your payment of ${response.data.currency} ${response.data.amount} has been confirmed.`,
        });
      } else {
        setVerificationStatus('failed');
        toast({
          title: "Payment Verification Failed",
          description: response.message || "Unable to verify payment.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setVerificationStatus('error');
      toast({
        title: "Payment Verification Error",
        description: "An error occurred while verifying your payment.",
        variant: "destructive"
      });
    }
  };

  const handleContinue = () => {
    navigate('/dashboard');
  };

  const renderContent = () => {
    switch (verificationStatus) {
      case 'verifying':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-500 animate-spin" />
            <h2 className="text-2xl font-bold text-white mb-2">Verifying Payment</h2>
            <p className="text-gray-400">Please wait while we confirm your payment...</p>
          </motion.div>
        );

      case 'success':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
            <p className="text-gray-400 mb-6">
              Your payment has been processed successfully.
            </p>
            {paymentData && (
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className="text-white font-semibold">
                      {paymentData.currency} {paymentData.amount}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="text-green-400 font-semibold capitalize">
                      {paymentData.payment_status}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <Button onClick={handleContinue} className="w-full">
              Continue to Dashboard
            </Button>
          </motion.div>
        );

      case 'failed':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-white mb-2">Payment Failed</h2>
            <p className="text-gray-400 mb-6">
              Your payment could not be processed. Please try again.
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => navigate('/dashboard')} 
                variant="outline" 
                className="flex-1"
              >
                Go to Dashboard
              </Button>
              <Button 
                onClick={() => window.history.back()} 
                className="flex-1"
              >
                Try Again
              </Button>
            </div>
          </motion.div>
        );

      case 'error':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-white mb-2">Verification Error</h2>
            <p className="text-gray-400 mb-6">
              There was an error verifying your payment. Please contact support.
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="glass-effect border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-center">Payment Verification</CardTitle>
          </CardHeader>
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default PaymentCallback;