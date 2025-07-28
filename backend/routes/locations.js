import express from 'express';
import { body, validationResult } from 'express-validator';
import Location from '../models/Location.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/v1/locations
// @desc    Get user's locations or all locations for admin
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    let locations;

    if (req.user.isAdminUser()) {
      // Admin: Get all locations visible to admins
      locations = await Location.getAdminLocations();
    } else {
      // User: Get their own locations
      locations = await Location.getUserLocationHistory(req.user._id);
    }

    res.json({
      success: true,
      data: locations
    });

  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving locations'
    });
  }
});

// @route   POST /api/v1/locations
// @desc    Add/share a new location
// @access  Private
router.post('/', authenticateToken, [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name too long'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long'),
  body('type').optional().isIn(['home', 'work', 'service_location', 'pickup', 'delivery', 'emergency', 'other']).withMessage('Invalid location type'),
  body('address').optional().isObject().withMessage('Address must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { 
      latitude, 
      longitude, 
      name, 
      description, 
      type = 'other', 
      address = {},
      isPrimary = false,
      accuracy,
      relatedBooking
    } = req.body;

    // Create location
    const location = new Location({
      user: req.user._id,
      name,
      description,
      coordinates: { latitude, longitude },
      address,
      type,
      isPrimary,
      accuracy,
      relatedBooking,
      metadata: {
        source: accuracy ? 'gps' : 'manual',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    await location.save();

    // Populate user information
    const populatedLocation = await Location.findById(location._id)
      .populate('user', 'name email phone');

    // Notify admins via socket
    const io = req.app.get('socketio');
    const eventData = {
      type: 'location',
      locationId: location._id,
      userId: req.user._id,
      userName: req.user.name,
      coordinates: { latitude, longitude },
      name: name || `${req.user.name}'s Location`,
      address: address.formatted || 'Address not provided',
      locationType: type,
      timestamp: new Date(),
      message: `New location shared by ${req.user.name}`
    };

    io.to('admin-room').emit('location-update', eventData);
    io.emit('admin-submission-received', eventData);

    console.log(`📍 Location shared by ${req.user.name} at ${latitude}, ${longitude}`);

    res.status(201).json({
      success: true,
      message: 'Location shared successfully',
      data: populatedLocation
    });

  } catch (error) {
    console.error('Share location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sharing location'
    });
  }
});

// @route   GET /api/v1/locations/nearby
// @desc    Find nearby locations
// @access  Private
router.get('/nearby', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, radius = 10000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const nearbyLocations = await Location.findNearby(
      parseFloat(latitude),
      parseFloat(longitude),
      parseInt(radius)
    );

    res.json({
      success: true,
      data: nearbyLocations,
      searchParams: {
        center: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
        radius: parseInt(radius)
      }
    });

  } catch (error) {
    console.error('Find nearby locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding nearby locations'
    });
  }
});

// @route   GET /api/v1/locations/maps-format
// @desc    Get locations in Google Maps format
// @access  Private
router.get('/maps-format', authenticateToken, async (req, res) => {
  try {
    let locations;

    if (req.user.isAdminUser()) {
      // Admin: Get all locations
      locations = await Location.getAdminLocations();
    } else {
      // User: Get their own locations
      locations = await Location.find({ user: req.user._id, isActive: true })
        .populate('user', 'name email');
    }

    // Format for Google Maps
    const mapLocations = locations.map(location => location.toGoogleMapsFormat());

    res.json({
      success: true,
      data: mapLocations,
      total: mapLocations.length
    });

  } catch (error) {
    console.error('Get maps format locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving locations for maps'
    });
  }
});

// @route   PUT /api/v1/locations/:id
// @desc    Update a location
// @access  Private
router.put('/:id', authenticateToken, [
  body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name too long'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description too long'),
  body('type').optional().isIn(['home', 'work', 'service_location', 'pickup', 'delivery', 'emergency', 'other']).withMessage('Invalid location type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Find location
    const location = await Location.findById(id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Check ownership (users can only update their own locations, admins can update any)
    if (!req.user.isAdminUser() && location.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this location'
      });
    }

    // Update coordinates if provided
    if (updateData.latitude && updateData.longitude) {
      location.coordinates = {
        latitude: updateData.latitude,
        longitude: updateData.longitude
      };
    }

    // Update other fields
    Object.keys(updateData).forEach(key => {
      if (key !== 'latitude' && key !== 'longitude' && updateData[key] !== undefined) {
        location[key] = updateData[key];
      }
    });

    await location.save();

    // Populate user information
    const populatedLocation = await Location.findById(location._id)
      .populate('user', 'name email phone');

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: populatedLocation
    });

  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating location'
    });
  }
});

// @route   DELETE /api/v1/locations/:id
// @desc    Delete a location
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Find location
    const location = await Location.findById(id);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    // Check ownership (users can only delete their own locations, admins can delete any)
    if (!req.user.isAdminUser() && location.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this location'
      });
    }

    // Soft delete by marking as inactive
    location.isActive = false;
    await location.save();

    res.json({
      success: true,
      message: 'Location deleted successfully'
    });

  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting location'
    });
  }
});

// @route   GET /api/v1/locations/admin/stats
// @desc    Get location statistics (Admin only)
// @access  Admin
router.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const totalLocations = await Location.countDocuments({ isActive: true });
    const locationsByType = await Location.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    const recentLocations = await Location.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name email');

    res.json({
      success: true,
      data: {
        totalLocations,
        locationsByType,
        recentLocations
      }
    });

  } catch (error) {
    console.error('Get location stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving location statistics'
    });
  }
});

export default router;