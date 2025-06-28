const Admin = require('../models/Admin');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const admin = await Admin.findOne({ username });

    if (!admin || admin.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // No token, just simple role return
    res.json({
      success: true,
      message: 'Login successful',
      role: 'adminJump',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
