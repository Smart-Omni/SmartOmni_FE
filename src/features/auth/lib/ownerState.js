import { previewImport, previewShop } from './demoAdapter'
import { demoDomainIssue } from './demoDomain'

export function createOwnerState() {
  return { accountType: 'owner', ownerInfo: { fullName: '', email: '', storeName: '', targetDomain: '' }, basicComplete: false, selectedPlan: null, connections: [], initialImportStatus: 'NOT_STARTED', importResult: null, resetKey: 0 }
}

export function confirmedShops(state) { return state.connections.filter(shop => shop.status === 'CONFIRMED' && shop.source === 'demo') }
export function allowedStep(state) {
  if (!state.basicComplete) return 0
  if (!state.selectedPlan) return 1
  if (!confirmedShops(state).length) return 2
  if (state.initialImportStatus !== 'COMPLETED') return 3
  return 4
}

const invalidateImport = { initialImportStatus: 'NOT_STARTED', importResult: null }

export function ownerReducer(state, action) {
  switch (action.type) {
    case 'SAVE_INFO': {
      // Whitelist non-credential fields; secrets cannot enter wizard state.
      const { fullName, email, storeName, targetDomain } = action.info
      const ownerInfo = { fullName: fullName.trim(), email: email.trim(), storeName: storeName.trim(), targetDomain: targetDomain.trim() }
      if (Object.values(ownerInfo).some(value => !value)) return state
      if (demoDomainIssue(ownerInfo.targetDomain)) return state
      const changed = Object.keys(ownerInfo).some(key => state.ownerInfo[key] !== ownerInfo[key])
      return { ...state, ownerInfo, basicComplete: true, ...(changed ? { selectedPlan: null, connections: [], ...invalidateImport } : {}) }
    }
    case 'SELECT_PLAN':
      if (!state.basicComplete || !['Free', 'Pro'].includes(action.plan) || state.selectedPlan === action.plan) return state
      return { ...state, selectedPlan: action.plan, connections: [], ...invalidateImport }
    case 'BEGIN_SHOP': {
      if (!state.basicComplete || !state.selectedPlan || state.connections.some(shop => shop.marketplace === action.marketplace)) return state
      if (state.selectedPlan === 'Free' && state.connections.length >= 1) return state
      const shop = previewShop(action.marketplace)
      return shop ? { ...state, connections: [...state.connections, shop], ...invalidateImport } : state
    }
    case 'CONFIRM_SHOP': {
      const candidate = state.connections.find(shop => shop.marketplace === action.marketplace)
      if (!candidate || candidate.source !== 'demo' || candidate.status !== 'AWAITING_CONFIRMATION') return state
      if (state.selectedPlan === 'Free' && confirmedShops(state).length >= 1) return state
      return { ...state, connections: state.connections.map(shop => shop.marketplace === action.marketplace ? { ...shop, status: 'CONFIRMED' } : shop), ...invalidateImport }
    }
    case 'REMOVE_SHOP':
      return { ...state, connections: state.connections.filter(shop => shop.marketplace !== action.marketplace), ...invalidateImport }
    case 'START_IMPORT':
      if (allowedStep(state) < 3 || state.initialImportStatus === 'IN_PROGRESS') return state
      return { ...state, initialImportStatus: 'IN_PROGRESS', importResult: null }
    case 'RESOLVE_IMPORT': {
      if (state.initialImportStatus !== 'IN_PROGRESS' || !confirmedShops(state).length) return state
      const result = previewImport(action.outcome)
      return result ? { ...state, initialImportStatus: result.status, importResult: result } : state
    }
    case 'RESET': return { ...createOwnerState(), resetKey: state.resetKey + 1 }
    default: return state
  }
}
