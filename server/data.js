import bcrypt from 'bcryptjs';

export const categories = [
  { id: 'home', name: 'Home services', icon: '⌂', color: 'mint', description: 'Repairs and help around the home' },
  { id: 'mechanical', name: 'Mechanical', icon: '⚙', color: 'amber', description: 'Vehicles, tyres and roadside help' },
  { id: 'construction', name: 'Builders & construction', icon: '▦', color: 'coral', description: 'Masonry, welding and civil work' },
  { id: 'interior', name: 'Interior & improvement', icon: '✦', color: 'blue', description: 'Make your space feel like yours' }
];

export const services = [
  { id: 'ac-repair', categoryId: 'home', name: 'AC repair', keywords: ['ac', 'air conditioner', 'cooling'] },
  { id: 'plumber', categoryId: 'home', name: 'Plumber', keywords: ['pipe', 'leak', 'water', 'tap'] },
  { id: 'electrician', categoryId: 'home', name: 'Electrician', keywords: ['power', 'switch', 'wiring', 'electric'] },
  { id: 'appliance-repair', categoryId: 'home', name: 'Appliance repair', keywords: ['washing machine', 'fridge', 'tv', 'appliance'] },
  { id: 'bike-repair', categoryId: 'mechanical', name: 'Bike repair', keywords: ['bike', 'motorcycle', 'chain'] },
  { id: 'tyre-help', categoryId: 'mechanical', name: 'Tyre & roadside help', keywords: ['tyre', 'tire', 'puncture', 'roadside'] },
  { id: 'mason', categoryId: 'construction', name: 'Mason', keywords: ['wall', 'brick', 'mason', 'civil'] },
  { id: 'painter', categoryId: 'construction', name: 'Painting', keywords: ['paint', 'wall putty', 'colour'] },
  { id: 'welder', categoryId: 'construction', name: 'Welding', keywords: ['weld', 'metal', 'grill'] },
  { id: 'interior-designer', categoryId: 'interior', name: 'Interior design', keywords: ['interior', 'design', 'renovation', 'decor'] },
  { id: 'carpenter', categoryId: 'interior', name: 'Carpenter', keywords: ['wood', 'furniture', 'carpenter'] }
];

const demoPassword = bcrypt.hashSync('Demo@123', 10);
export const users = [
  { id: 'cust-demo', role: 'customer', name: 'Aarav Mehta', email: 'customer@demo.local', phone: '+91 98765 43210', passwordHash: demoPassword, location: { lat: 12.9716, lng: 77.5946, label: 'Bengaluru, Karnataka' } },
  { id: 'worker-1', role: 'worker', name: 'Ravi Kumar', email: 'ravi@demo.local', phone: '+91 90000 00001', passwordHash: demoPassword, verified: true, online: true, skills: ['ac-repair', 'appliance-repair'], experience: 8, completedJobs: 214, rating: 4.9, serviceArea: 'Indiranagar · 12 km', location: { lat: 12.9784, lng: 77.6408, label: 'Indiranagar' } },
  { id: 'worker-2', role: 'worker', name: 'Meena Suresh', email: 'meena@demo.local', phone: '+91 90000 00002', passwordHash: demoPassword, verified: true, online: true, skills: ['plumber', 'electrician'], experience: 6, completedJobs: 141, rating: 4.8, serviceArea: 'Koramangala · 10 km', location: { lat: 12.9352, lng: 77.6245, label: 'Koramangala' } },
  { id: 'worker-3', role: 'worker', name: 'Imran Shaikh', email: 'imran@demo.local', phone: '+91 90000 00003', passwordHash: demoPassword, verified: true, online: true, skills: ['bike-repair', 'tyre-help'], experience: 11, completedJobs: 329, rating: 4.7, serviceArea: 'HSR Layout · 15 km', location: { lat: 12.9116, lng: 77.6389, label: 'HSR Layout' } },
  { id: 'worker-4', role: 'worker', name: 'Lakshmi Devi', email: 'lakshmi@demo.local', phone: '+91 90000 00004', passwordHash: demoPassword, verified: true, online: false, skills: ['mason', 'painter', 'welder'], experience: 14, completedJobs: 401, rating: 4.9, serviceArea: 'Jayanagar · 18 km', location: { lat: 12.925, lng: 77.5838, label: 'Jayanagar' } },
  { id: 'worker-5', role: 'worker', name: 'Nikhil Rao', email: 'nikhil@demo.local', phone: '+91 90000 00005', passwordHash: demoPassword, verified: true, online: true, skills: ['interior-designer', 'carpenter', 'painter'], experience: 9, completedJobs: 187, rating: 4.6, serviceArea: 'Malleshwaram · 14 km', location: { lat: 13.0035, lng: 77.5708, label: 'Malleshwaram' } }
];

export const bookings = [];
export const notifications = [];
export const reviews = [];
