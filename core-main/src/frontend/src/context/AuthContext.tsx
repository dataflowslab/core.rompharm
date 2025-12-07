import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';

interface AuthContextType {
  token: string | null;
  username: string | null;
  name: string | null;
  isStaff: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('auth_token')
  );
  const [username, setUsername] = useState<string | null>(
    localStorage.getItem('auth_username')
  );
  const [name, setName] = useState<string | null>(
    localStorage.getItem('auth_name')
  );
  const [isStaff, setIsStaff] = useState<boolean>(
    localStorage.getItem('auth_is_staff') === 'true'
  );

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Token ${token}`;
      
      // Verify token and load user info (including name)
      api.get('/api/auth/verify')
        .then(response => {
          if (response.data.name && !name) {
            setName(response.data.name);
            localStorage.setItem('auth_name', response.data.name);
          }
        })
        .catch(error => {
          console.error('Failed to verify token:', error);
          // Token might be invalid, logout
          if (error.response?.status === 401) {
            logout();
          }
        });
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = async (username: string, password: string) => {
    console.log('AuthContext: Logging in...');
    const response = await api.post('/api/auth/login', { username, password });
    const { token: newToken, username: user, is_staff, name: userName } = response.data;
    
    console.log('AuthContext: Login successful, token:', newToken?.substring(0, 20) + '...', 'is_staff:', is_staff, 'name:', userName);
    
    setToken(newToken);
    setUsername(user);
    setName(userName);
    setIsStaff(is_staff);
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_username', user);
    localStorage.setItem('auth_name', userName || '');
    localStorage.setItem('auth_is_staff', is_staff.toString());
    
    // Immediately set the token in axios headers
    api.defaults.headers.common['Authorization'] = `Token ${newToken}`;
    console.log('AuthContext: Token set in axios headers');
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    setName(null);
    setIsStaff(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_name');
    localStorage.removeItem('auth_is_staff');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        name,
        isStaff,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
