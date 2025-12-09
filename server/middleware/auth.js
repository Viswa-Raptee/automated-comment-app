const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access denied' });
    console.log("🔐 Authenticating Token:", token);
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log(req.user ? "✅ Token Validated" : "❌ Token Invalid");
        next();
    } catch (e) {
        res.status(400).json({ error: 'Invalid token' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    next();
};

module.exports = { authenticate, isAdmin };