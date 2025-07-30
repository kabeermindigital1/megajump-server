const DiscountVoucher = require('../models/DiscountVoucher');

// ✅ Create a new discount voucher
exports.createDiscountVoucher = async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      minimumAmount,
      maximumDiscount,
      usageLimit,
      validFrom,
      validUntil,
      applicableFor
    } = req.body;

    // Validate required fields
    if (!code || !name || !discountType || !discountValue || !validFrom || !validUntil) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: code, name, discountType, discountValue, validFrom, validUntil"
      });
    }

    // Check if voucher code already exists
    const existingVoucher = await DiscountVoucher.findOne({ code: code.toUpperCase() });
    if (existingVoucher) {
      return res.status(400).json({
        success: false,
        message: "Voucher code already exists"
      });
    }

    // Validate discount value
    if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 1 and 100"
      });
    }

    if (discountType === 'fixed' && discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Fixed discount amount must be greater than 0"
      });
    }

    // Validate dates
    const fromDate = new Date(validFrom);
    const untilDate = new Date(validUntil);
    
    if (fromDate >= untilDate) {
      return res.status(400).json({
        success: false,
        message: "Valid until date must be after valid from date"
      });
    }

    const voucher = new DiscountVoucher({
      code: code.toUpperCase(),
      name,
      description,
      discountType,
      discountValue,
      minimumAmount: minimumAmount || 0,
      maximumDiscount,
      usageLimit: usageLimit || -1,
      validFrom: fromDate,
      validUntil: untilDate,
      applicableFor: applicableFor || 'all'
    });

    await voucher.save();

    res.status(201).json({
      success: true,
      message: "Discount voucher created successfully",
      data: voucher
    });

  } catch (error) {
    console.error("Error creating discount voucher:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while creating the voucher",
      error: error.message
    });
  }
};

// ✅ Get all discount vouchers
exports.getAllDiscountVouchers = async (req, res) => {
  try {
    const { active } = req.query;
    let filter = {};
    
    if (active !== undefined) {
      filter.isActive = active === 'true';
    }

    const vouchers = await DiscountVoucher.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: vouchers
    });

  } catch (error) {
    console.error("Error fetching discount vouchers:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching vouchers",
      error: error.message
    });
  }
};

// ✅ Get discount voucher by ID
exports.getDiscountVoucherById = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await DiscountVoucher.findById(id);

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Discount voucher not found"
      });
    }

    res.json({
      success: true,
      data: voucher
    });

  } catch (error) {
    console.error("Error fetching discount voucher:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching the voucher",
      error: error.message
    });
  }
};

// ✅ Update discount voucher
exports.updateDiscountVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if voucher exists
    const existingVoucher = await DiscountVoucher.findById(id);
    if (!existingVoucher) {
      return res.status(404).json({
        success: false,
        message: "Discount voucher not found"
      });
    }

    // If code is being updated, check for duplicates
    if (updateData.code && updateData.code !== existingVoucher.code) {
      const duplicateVoucher = await DiscountVoucher.findOne({ 
        code: updateData.code.toUpperCase(),
        _id: { $ne: id }
      });
      
      if (duplicateVoucher) {
        return res.status(400).json({
          success: false,
          message: "Voucher code already exists"
        });
      }
      
      updateData.code = updateData.code.toUpperCase();
    }

    // Validate discount value if being updated
    if (updateData.discountValue) {
      const discountType = updateData.discountType || existingVoucher.discountType;
      
      if (discountType === 'percentage' && (updateData.discountValue <= 0 || updateData.discountValue > 100)) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount must be between 1 and 100"
        });
      }

      if (discountType === 'fixed' && updateData.discountValue <= 0) {
        return res.status(400).json({
          success: false,
          message: "Fixed discount amount must be greater than 0"
        });
      }
    }

    // Validate dates if being updated
    if (updateData.validFrom || updateData.validUntil) {
      const fromDate = updateData.validFrom ? new Date(updateData.validFrom) : existingVoucher.validFrom;
      const untilDate = updateData.validUntil ? new Date(updateData.validUntil) : existingVoucher.validUntil;
      
      if (fromDate >= untilDate) {
        return res.status(400).json({
          success: false,
          message: "Valid until date must be after valid from date"
        });
      }
    }

    const updatedVoucher = await DiscountVoucher.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Discount voucher updated successfully",
      data: updatedVoucher
    });

  } catch (error) {
    console.error("Error updating discount voucher:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the voucher",
      error: error.message
    });
  }
};

// ✅ Delete discount voucher
exports.deleteDiscountVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await DiscountVoucher.findById(id);

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Discount voucher not found"
      });
    }

    await DiscountVoucher.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Discount voucher deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting discount voucher:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while deleting the voucher",
      error: error.message
    });
  }
};

// ✅ Validate discount voucher
exports.validateDiscountVoucher = async (req, res) => {
  try {
    const { code, amount } = req.body;

    if (!code || !amount) {
      return res.status(400).json({
        success: false,
        message: "Voucher code and amount are required"
      });
    }

    const voucher = await DiscountVoucher.findOne({ 
      code: code.toUpperCase(),
      isActive: true
    });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Invalid voucher code"
      });
    }

    // Check if voucher is expired
    const now = new Date();
    if (now < voucher.validFrom || now > voucher.validUntil) {
      return res.status(400).json({
        success: false,
        message: "Voucher is not valid at this time"
      });
    }

    // Check usage limit
    if (voucher.usageLimit !== -1 && voucher.usedCount >= voucher.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Voucher usage limit exceeded"
      });
    }

    // Check minimum amount
    if (amount < voucher.minimumAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum amount required: €${voucher.minimumAmount}`
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (voucher.discountType === 'percentage') {
      discountAmount = (amount * voucher.discountValue) / 100;
      if (voucher.maximumDiscount && discountAmount > voucher.maximumDiscount) {
        discountAmount = voucher.maximumDiscount;
      }
    } else {
      discountAmount = voucher.discountValue;
    }

    const finalAmount = Math.max(0, amount - discountAmount);

    res.json({
      success: true,
      message: "Voucher is valid",
      data: {
        voucher: {
          id: voucher._id,
          code: voucher.code,
          name: voucher.name,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue
        },
        originalAmount: amount,
        discountAmount: discountAmount,
        finalAmount: finalAmount
      }
    });

  } catch (error) {
    console.error("Error validating discount voucher:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while validating the voucher",
      error: error.message
    });
  }
}; 

// ✅ Increment voucher usage count
exports.incrementVoucherUsage = async (req, res) => {
  try {
    const { voucherId } = req.body;

    if (!voucherId) {
      return res.status(400).json({
        success: false,
        message: "Voucher ID is required"
      });
    }

    const voucher = await DiscountVoucher.findById(voucherId);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found"
      });
    }

    // Check if voucher can still be used
    if (voucher.usageLimit !== -1 && voucher.usedCount >= voucher.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "Voucher usage limit exceeded"
      });
    }

    // Increment usage count
    voucher.usedCount += 1;
    await voucher.save();

    res.json({
      success: true,
      message: "Voucher usage count incremented",
      data: {
        voucherId: voucher._id,
        code: voucher.code,
        usedCount: voucher.usedCount,
        usageLimit: voucher.usageLimit
      }
    });

  } catch (error) {
    console.error("Error incrementing voucher usage:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating voucher usage",
      error: error.message
    });
  }
};

// ✅ Get voucher usage statistics
exports.getVoucherUsageStats = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await DiscountVoucher.findById(id);

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found"
      });
    }

    const stats = {
      voucherId: voucher._id,
      code: voucher.code,
      name: voucher.name,
      usedCount: voucher.usedCount,
      usageLimit: voucher.usageLimit,
      remainingUses: voucher.usageLimit === -1 ? 'Unlimited' : Math.max(0, voucher.usageLimit - voucher.usedCount),
      isActive: voucher.isActive,
      validFrom: voucher.validFrom,
      validUntil: voucher.validUntil,
      isExpired: new Date() > voucher.validUntil
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error("Error fetching voucher usage stats:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching voucher stats",
      error: error.message
    });
  }
}; 