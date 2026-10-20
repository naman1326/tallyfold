import { createContext, useContext, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export const VALID_CREDENTIALS = {
  username: 'user',
  password: 'qwer1234',
};

export interface AuthContextType {
  isAuthenticated: boolean;
  user: string | null;
  login: (usernameInput: string, passwordInput: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AUTH_STORAGE_KEY = 'tallyfold_auth';
export const USER_STORAGE_KEY = 'tallyfold_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [user, setUser] = useState<string | null>(() => {
    try {
      return (
        localStorage.getItem(USER_STORAGE_KEY) ||
        (localStorage.getItem(AUTH_STORAGE_KEY) === 'true' ? VALID_CREDENTIALS.username : null)
      );
    } catch {
      return null;
    }
  });

  const login = (usernameInput: string, passwordInput: string) => {
    const trimmedUser = usernameInput.trim();
    if (trimmedUser === VALID_CREDENTIALS.username && passwordInput === VALID_CREDENTIALS.password) {
      setIsAuthenticated(true);
      setUser(trimmedUser);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
        localStorage.setItem(USER_STORAGE_KEY, trimmedUser);
        localStorage.setItem('userId', trimmedUser);
      } catch {
        // Fallback if localStorage is unavailable
      }
      return { success: true };
    }
    return {
      success: false,
      error: 'Invalid username or password. Please check your credentials and try again.',
    };
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // Fallback if localStorage is unavailable
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
