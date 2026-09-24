import jwt from 'jsonwebtoken';

export function auth(requiredRoles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    try {
      req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'development-secret');
      if (requiredRoles.length && !requiredRoles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have access to this resource' });
      next();
    } catch {
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
  };
}
