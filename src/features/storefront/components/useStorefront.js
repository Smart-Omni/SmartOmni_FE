import { useContext, createContext } from 'react'

export const StorefrontContext = createContext(null)
export function useStorefront() {
  return useContext(StorefrontContext)
}
