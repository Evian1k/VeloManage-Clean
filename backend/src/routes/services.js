import express from 'express';
import { body, validationResult } from 'express-validator';
import Service from '../models/Service.js';
import Vehicle from '../models/Vehicle.js';

const router = express.Router();

// @route   GET /api/v1/services
// @desc    Get all services or user services
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    let query = {};
    
    // If not admin, only show user's services
    if (!isAdmin) {
      query.user = userId;
    }
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const services = await Service.find(query)
      .populate('user', 'name email phone')
      .populate('vehicle', 'make model year licensePlate color')
      .populate('assignedTo', 'name email')
      .populate('assignedTruck', 'truckNumber type')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Service.countDocuments(query);

    res.json({
      success: true,
      services,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Services error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/services
// @desc    Create a new service request
// @access  Private
router.post('/', [
  body('vehicleId').notEmpty().withMessage('Vehicle is required'),
  body('serviceType').notEmpty().withMessage('Service type is required'),
  body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
  body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('preferredDate').isISO8601().withMessage('Valid preferred date is required'),
  body('location.address').notEmpty().withMessage('Service location is required'),
  body('urgency').optional().isIn(['low', 'medium', 'high', 'critical'])
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
    const { vehicleId, serviceType, title, description, preferredDate, location, urgency, estimatedCost } = req.body;

    // Verify vehicle belongs to user (unless admin)
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    if (!req.user.isAdmin && vehicle.owner.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create service for this vehicle'
      });
    }

    const service = new Service({
      user: userId,
      vehicle: vehicleId,
      serviceType,
      title,
      description,
      preferredDate,
      location,
      urgency: urgency || 'medium',
      estimatedCost: estimatedCost || 0
    });

    await service.save();
    
    // Populate the response
    await service.populate([
      { path: 'user', select: 'name email phone' },
      { path: 'vehicle', select: 'make model year licensePlate color' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Service request created successfully',
      service
    });
  } catch (error) {
    console.error('Service creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/v1/services/:id
// @desc    Get single service by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.isAdmin;

    const service = await Service.findById(serviceId)
      .populate('user', 'name email phone')
      .populate('vehicle', 'make model year licensePlate color vin')
      .populate('assignedTo', 'name email phone')
      .populate('assignedTruck', 'truckNumber type model')
      .populate('notes.createdBy', 'name email');

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Check if user can access this service
    if (!isAdmin && service.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this service'
      });
    }

    res.json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/v1/services/:id/status
// @desc    Update service status (Admin only)
// @access  Private (Admin)
router.put('/:id/status', [
  body('status').isIn(['pending', 'approved', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
], async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const serviceId = req.params.id;
    const { status, notes } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    service.status = status;
    
    if (status === 'completed') {
      service.completedAt = new Date();
    }

    if (notes) {
      service.addNote(notes, req.user.id);
    }

    await service.save();
    await service.populate([
      { path: 'user', select: 'name email phone' },
      { path: 'vehicle', select: 'make model year licensePlate' }
    ]);

    res.json({
      success: true,
      message: 'Service status updated successfully',
      service
    });
  } catch (error) {
    console.error('Update service status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/v1/services/:id/notes
// @desc    Add note to service
// @access  Private
router.post('/:id/notes', [
  body('text').trim().isLength({ min: 1, max: 500 }).withMessage('Note text must be between 1 and 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const serviceId = req.params.id;
    const userId = req.user.id;
    const { text } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Check if user can add notes (service owner or admin)
    if (!req.user.isAdmin && service.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add notes to this service'
      });
    }

    await service.addNote(text, userId);
    await service.populate('notes.createdBy', 'name email');

    res.json({
      success: true,
      message: 'Note added successfully',
      notes: service.notes
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;