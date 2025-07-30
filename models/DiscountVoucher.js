const mongoose = require('mongoose');

const discountVoucherSchema = new mongoose.Schema({
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true,
    trim: true
  },
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String 
  },
  discountType: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    required: true 
  },
  discountValue: { 
    type: Number, 
    required: true 
  },
  minimumAmount: { 
    type: Number, 
    default: 0 
  },
  maximumDiscount: { 
    type: Number 
  },
  usageLimit: { 
    type: Number, 
    default: -1 // -1 means unlimited
  },
  usedCount: { 
    type: Number, 
    default: 0 
  },
  validFrom: { 
    type: Date, 
    required: true 
  },
  validUntil: { 
    type: Date, 
    required: true 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  applicableFor: {
    type: String,
    enum: ['all', 'tickets', 'bundles', 'socks'],
    default: 'all'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt field before saving
discountVoucherSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('DiscountVoucher', discountVoucherSchema); 