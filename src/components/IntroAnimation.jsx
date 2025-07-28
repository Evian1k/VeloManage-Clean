import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Zap, Shield, Globe, ArrowRight } from 'lucide-react';

const IntroAnimation = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const steps = [
    {
      icon: <Truck className="w-16 h-16" />,
      title: "AutoCare Pro",
      subtitle: "Revolutionizing Vehicle Management",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Zap className="w-16 h-16" />,
      title: "Lightning Fast",
      subtitle: "Real-time tracking & instant updates",
      color: "from-yellow-500 to-orange-500"
    },
    {
      icon: <Shield className="w-16 h-16" />,
      title: "Secure & Reliable",
      subtitle: "Enterprise-grade security",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: <Globe className="w-16 h-16" />,
      title: "Global Reach",
      subtitle: "Worldwide payment & location services",
      color: "from-purple-500 to-pink-500"
    }
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        // Start exit animation
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            onComplete && onComplete();
          }, 1000);
        }, 1000);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentStep, steps.length, onComplete]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        duration: 0.5,
        staggerChildren: 0.2
      }
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      transition: {
        duration: 1,
        ease: "easeInOut"
      }
    }
  };

  const iconVariants = {
    hidden: { 
      scale: 0,
      rotate: -180,
      opacity: 0
    },
    visible: { 
      scale: 1,
      rotate: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 15,
        duration: 0.8
      }
    }
  };

  const textVariants = {
    hidden: { 
      y: 50,
      opacity: 0
    },
    visible: { 
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10,
        delay: 0.3
      }
    }
  };

  const backgroundVariants = {
    hidden: { scale: 0 },
    visible: { 
      scale: 1,
      transition: {
        duration: 2,
        ease: "easeOut"
      }
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
        >
          {/* Animated background */}
          <motion.div
            variants={backgroundVariants}
            className="absolute inset-0 opacity-20"
            style={{
              background: `
                radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.3) 0%, transparent 50%),
                radial-gradient(circle at 40% 60%, rgba(16, 185, 129, 0.3) 0%, transparent 50%)
              `
            }}
          />

          {/* Floating particles */}
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                opacity: 0
              }}
              animate={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          ))}

          {/* Main content */}
          <motion.div className="relative z-10 text-center">
            {/* Progress bar */}
            <motion.div 
              className="mb-8 w-64 h-1 bg-gray-700 rounded-full overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: 256 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                initial={{ width: "0%" }}
                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </motion.div>

            {/* Icon with pulsing effect */}
            <motion.div
              variants={iconVariants}
              className={`
                relative mx-auto mb-6 w-24 h-24 rounded-full 
                bg-gradient-to-r ${steps[currentStep].color}
                flex items-center justify-center text-white
                shadow-2xl
              `}
            >
              {/* Pulsing rings */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [1, 0, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white"
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [1, 0, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5
                }}
              />
              
              {steps[currentStep].icon}
            </motion.div>

            {/* Text content */}
            <motion.div variants={textVariants}>
              <motion.h1 
                className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
                key={currentStep}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                {steps[currentStep].title}
              </motion.h1>
              
              <motion.p 
                className="text-xl md:text-2xl text-gray-300"
                key={`subtitle-${currentStep}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {steps[currentStep].subtitle}
              </motion.p>
            </motion.div>

            {/* Loading dots */}
            <motion.div 
              className="flex justify-center mt-8 space-x-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {steps.map((_, index) => (
                <motion.div
                  key={index}
                  className={`w-3 h-3 rounded-full ${
                    index <= currentStep ? 'bg-white' : 'bg-gray-600'
                  }`}
                  animate={{
                    scale: index === currentStep ? [1, 1.3, 1] : 1,
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: index === currentStep ? Infinity : 0,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </motion.div>

            {/* Skip button */}
            <motion.button
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onComplete && onComplete(), 100);
              }}
              className="absolute bottom-8 right-8 flex items-center space-x-2 px-4 py-2 text-gray-400 hover:text-white transition-colors duration-300"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span>Skip</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroAnimation;