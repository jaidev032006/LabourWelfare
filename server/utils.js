export function distanceKm(a, b) {
  const earthRadius = 6371;
  const toRadians = value => value * Math.PI / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const latitudeA = toRadians(a.lat);
  const latitudeB = toRadians(b.lat);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export function tokenPayload(user) {
  return { id: user.id, role: user.role, email: user.email, name: user.name };
}

export function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
