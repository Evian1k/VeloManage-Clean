import express from 'express';
import { body, validationResult } from 'express-validator';
import Vehicle from '../models/Vehicle.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/vehicles/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// @route   GET /api/v1/vehicles
// @desc    Get user's vehicles or all vehicles (admin)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    let query = { isActive: true };
    
    // If not admin, only show user's vehicles
    if (!isAdmin) {
      query.owner = userId;
    }

    const vehicles = await Vehicle.find(query)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      vehicles
    });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/vehicles
// @desc    Create a new vehicle
// @access  Private
router.post('/', [
  body('make').trim().isLength({ min: 2, max: 50 }).withMessage('Make must be between 2 and 50 characters'),
  body('model').trim().isLength({ min: 2, max: 50 }).withMessage('Model must be between 2 and 50 characters'),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage('Invalid year'),
  body('licensePlate').trim().isLength({ min: 2, max: 20 }).withMessage('License plate must be between 2 and 20 characters'),
  body('color').optional().trim().isLength({ max: 30 }),
  body('vin').optional().trim().isLength({ min: 17, max: 17 }).withMessage('VIN must be exactly 17 characters'),
  body('mileage').optional().isInt({ min: 0 }).withMessage('Mileage must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const vehicleData = {
      ...req.body,
      owner: userId,
      licensePlate: req.body.licensePlate.toUpperCase()
    };

    // Check if license plate already exists
    const existingVehicle = await Vehicle.findOne({ 
      licensePlate: vehicleData.licensePlate,
      isActive: true 
    });
    
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: 'A vehicle with this license plate already exists'
      });
    }

    const vehicle = new Vehicle(vehicleData);
    await vehicle.save();
    await vehicle.populate('owner', 'name email');

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      vehicle
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/vehicles/:id
// @desc    Get single vehicle by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    const vehicle = await Vehicle.findById(vehicleId)
      .populate('owner', 'name email phone');

    if (!vehicle || !vehicle.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check if user can access this vehicle
    if (!isAdmin && vehicle.owner._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this vehicle'
      });
    }

    res.json({
      success: true,
      vehicle
    });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/v1/vehicles/:id
// @desc    Update vehicle
// @access  Private
router.put('/:id', [
  body('make').optional().trim().isLength({ min: 2, max: 50 }),
  body('model').optional().trim().isLength({ min: 2, max: 50 }),
  body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
  body('licensePlate').optional().trim().isLength({ min: 2, max: 20 }),
  body('color').optional().trim().isLength({ max: 30 }),
  body('mileage').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const vehicleId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle || !vehicle.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check if user can update this vehicle
    if (!isAdmin && vehicle.owner.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this vehicle'
      });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key === 'licensePlate') {
        vehicle[key] = req.body[key].toUpperCase();
      } else {
        vehicle[key] = req.body[key];
      }
    });

    await vehicle.save();
    await vehicle.populate('owner', 'name email');

    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      vehicle
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/v1/vehicles/:id
// @desc    Delete (deactivate) vehicle
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check if user can delete this vehicle
    if (!isAdmin && vehicle.owner.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this vehicle'
      });
    }

    vehicle.isActive = false;
    await vehicle.save();

    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/vehicles/:id/maintenance
// @desc    Add maintenance record
// @access  Private
router.post('/:id/maintenance', [
  body('serviceType').notEmpty().withMessage('Service type is required'),
  body('cost').optional().isFloat({ min: 0 }).withMessage('Cost must be a positive number'),
  body('mileageAtService').optional().isInt({ min: 0 }).withMessage('Mileage must be a positive number'),
  body('serviceDate').optional().isISO8601().withMessage('Invalid service date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const vehicleId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle || !vehicle.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check if user can add maintenance to this vehicle
    if (!isAdmin && vehicle.owner.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add maintenance to this vehicle'
      });
    }

    await vehicle.addMaintenanceRecord(req.body);

    res.json({
      success: true,
      message: 'Maintenance record added successfully',
      vehicle
    });
  } catch (error) {
    console.error('Add maintenance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/vehicles/:id/images
// @desc    Upload vehicle images
// @access  Private
router.post('/:id/images', upload.array('images', 5), async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle || !vehicle.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check if user can upload images to this vehicle
    if (!isAdmin && vehicle.owner.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload images to this vehicle'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    // Add image records to vehicle
    req.files.forEach(file => {
      vehicle.images.push({
        filename: file.filename,
        originalName: file.originalname,
        description: req.body.description || ''
      });
    });

    await vehicle.save();

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      images: vehicle.images
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;