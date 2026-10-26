export const staffScreens = [
  ['products', 'Internal products', ['products:read'], '2.5'], ['imports', 'Marketplace imports', ['products:read'], '2.3, 2.6'],
  ['prices', 'Prices & promotions', ['products:read', 'prices:read'], '2.4, 2.7, 2.10'],
  ['inventory', 'Inventory', ['inventory:read'], '2.8, 2.9, 2.11'], ['mapping', 'SKU & warehouse', ['products:read', 'inventory:read'], '2.12, 2.13, 2.22'],
  ['orders', 'Orders & shipments', ['orders:read'], '2.14–2.19'], ['sync', 'Inventory sync', ['inventory:read'], '2.20, 2.21, 2.23'],
  ['conversations', 'Conversations', ['conversations:read'], '2.25–2.27'],
  ['returns', 'Returns & inspection', ['returns:read'], '2.30, 2.39'],
  ['disputes', 'Disputes', ['disputes:read'], '2.36'], ['complaints', 'Complaints', ['complaints:read'], '2.37, 2.38'],
  ['business', 'Business dashboard', ['business:read'], '2.31'],
  ['sales-events', 'Sales events', ['planning:read'], '2.28'], ['forecasts', 'Demand forecasts', ['planning:read'], '2.29'],
  ['costs', 'Business costs', ['finance:read'], '2.32'], ['profit', 'Profit', ['finance:read'], '2.35'],
  ['advisor', 'AI advisor', ['advisor:use'], '2.33'], ['strategy', 'Strategic advice', ['advisor:use'], '2.34'],
]
export const staffCan = (session, permissions) => permissions.every(permission => session.permissions.includes(permission))
export const staffScreenGroups = [
  ['products', 'imports', 'prices', 'inventory', 'mapping', 'orders', 'sync'],
  ['conversations', 'returns', 'disputes', 'complaints'], ['business'],
  ['sales-events', 'forecasts'], ['costs', 'profit'], ['advisor', 'strategy'],
]
