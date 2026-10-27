import { products } from './catalog'

// Public presentation fixtures only. Catalog assignments are illustrative, not live inventory.
export const publicStores = [
  { id: 'demo-tenant', slug: 'everyday-studio', name: 'Everyday Studio', initials: 'ES', category: 'Everyday essentials', description: 'Considered essentials for your space and your everyday.', image: '/images/storefront/wireless-mouse.png', contain: true, productIds: products.map(product => product.id) },
  { id: 'tenant-02', slug: 'moss-and-clay', name: 'Moss & Clay', initials: 'MC', category: 'Home & living', description: 'Quiet shapes. Natural textures. A little more home.', image: '/images/storefront/cone-lamp.jpg', productIds: ['ceramic-cup', 'cone-desk-light', 'accent-chair'] },
  { id: 'tenant-03', slug: 'sunday-supply', name: 'Sunday Supply', initials: 'SS', category: 'Style & accessories', description: 'Easy favourites for wherever the day takes you.', image: '/images/product/tote.png', contain: true, productIds: ['everyday-tote', 'cotton-tee', 'canvas-backpack', 'court-sneakers', 'classic-watch', 'shoulder-bag', 'running-shoes'] },
  { id: 'tenant-06', slug: 'form-and-function', name: 'Form & Function — Home and Everyday Essentials', initials: 'FF', category: 'Home & living', description: 'Useful things, thoughtfully chosen for your daily rituals.', image: '/images/storefront/desk-lamp.jpg', productIds: ['desk-light', 'cone-desk-light', 'accent-chair', 'wireless-mouse', 'mechanical-keyboard'] },
  { id: 'tenant-07', slug: 'daybreak-coffee', name: 'Daybreak Coffee', initials: 'DC', category: 'Coffee & rituals', description: 'Make a little time for your morning ritual.', image: products.find(product => product.id === 'ceramic-cup').image, productIds: ['ceramic-cup'] },
  { id: 'tenant-08', slug: 'paper-house', name: 'Paper House', initials: 'PH', category: 'Workspace', description: 'Small details for a desk that feels like you.', image: '/images/product/keyboard.png', contain: true, productIds: ['wireless-mouse', 'mechanical-keyboard', 'desk-light'] },
]

export const storeCategories = ['All stores', ...new Set(publicStores.map(store => store.category))]
export const storeHostname = store => `${store.slug}.smartomni.example`
