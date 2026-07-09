export const APP_NAME = 'AQUAPRANA Admin Panel'
export const APP_EYEBROW = 'WEBSITE ONLY ADMIN MONITORING'

export const NAV_ITEMS = [
  { label: 'Overview', path: '/' },
  { label: 'Farmers', path: '/farmers' },
  { label: 'Ponds', path: '/ponds' },
  { label: 'Daily Logs', path: '/logs' },
  { label: 'Expenses', path: '/expenses' },
  { label: 'Inventory', path: '/inventory' },
  { label: 'AquaGPT', path: '/aquagpt' },
] as const

export const AUTH_STORAGE_KEY = 'aquaprana_admin_session'
