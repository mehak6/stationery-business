'use client'

import { createContext, useContext } from 'react'
import { User, Session } from '@supabase/supabase-js'

// Temporarily simplified profile interface
interface Profile {
  id: string
  username: string
  full_name: string
  role: string
}

// Simplified auth context type
interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, userData?: any) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: any) => Promise<void>
}

// Create context with null values for now
const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Simplified AuthProvider
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // Return simplified context with mock functions
  const value: AuthContextType = {
    user: null,
    profile: null,
    session: null,
    loading: false,
    signIn: async () => {},
    signUp: async () => {},
    signOut: async () => {},
    updateProfile: async () => {}
  }

  return {
    ...value,
    children
  }
}