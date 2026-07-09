import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react'
import { login as signIn, logout as signOut } from '../services/auth'
import { getAdminProfile } from '../services/admin'
import type { AdminUser } from '../types/user'
import { useEffect } from "react";
import { getCurrentUser } from "../services/auth";

interface AuthContextValue {
  user: AdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null)

// function readStoredUser(): AdminUser | null {
//   try {
//     const raw = localStorage.getItem(AUTH_STORAGE_KEY)
//     if (!raw) return null
//     return JSON.parse(raw) as AdminUser
//   } catch {
//     return null
//   }
// }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const login = useCallback(async (email: string, password: string) => {

    // Login using Supabase Auth
    await signIn(email, password)
  
    // Get admin details from admins table
    const admin = await getAdminProfile()
  
    if (!admin) {
      throw new Error("Not authorized")
    }
  
    setUser(admin)
    setIsLoading(false)
  
  }, [])

  const logout = useCallback(async () => {

    await signOut()
  
    setUser(null)
  
  }, [])


  useEffect(() => {
    const restoreSession = async () => {
      try {
        const authUser = await getCurrentUser();
  
        if (!authUser) {
          setIsLoading(false)
          return;
        }
  
        const admin = await getAdminProfile();
  
        if (admin) {
          setUser(admin);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false)
      }
    };
  
    restoreSession();
  }, []);
  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      loading: isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
