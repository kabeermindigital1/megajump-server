const Admin = require('../models/Admin');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const admin = await Admin.findOne({ username });

    if (!admin || admin.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Return different roles based on username
    let role;
    if (username === 'admin') {
      role = 'adminJump'; // Full admin access
    } else if (username === 'cashier') {
      role = 'cashier'; // Cash payment only
    } else {
      role = 'adminJump'; // Default fallback
    }

    res.json({
      success: true,
      message: 'Login successful',
      role: role,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
