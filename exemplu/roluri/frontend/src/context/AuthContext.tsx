import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';

interface AuthContextType {
  token: string | null;
  username: string | null;
  name: string | null;
  domain: string | null;
  roleId: string | null;
  roleName: string | null;
  isAdmin: boolean;
  login: (username: string, password: string, domain?: string) => Promise<void>;
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
  const [domain, setDomain] = useState<string | null>(
    localStorage.getItem('auth_domain')
  );
  const [roleId, setRoleId] = useState<string | null>(
    localStorage.getItem('auth_role_id')
  );
  const [roleName, setRoleName] = useState<string | null>(
    localStorage.getItem('auth_role_name')
  );

  const isAdmin = (roleName || '').toLowerCase() === 'admin' || (roleName || '').toLowerCase() === 'administrator';

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
          if (response.data.role_id) {
            setRoleId(response.data.role_id);
            localStorage.setItem('auth_role_id', response.data.role_id);
          }
          if (response.data.role_name) {
            setRoleName(response.data.role_name);
            localStorage.setItem('auth_role_name', response.data.role_name);
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

  const login = async (username: string, password: string, domain?: string) => {
    console.log('AuthContext: Logging in with domain:', domain);
    const response = await api.post('/api/auth/login/local', { username, password, domain });
    const { token: newToken, username: user, name: userName, role_id, role_name } = response.data;
    
    console.log('AuthContext: Login successful, token:', newToken?.substring(0, 20) + '...', 'role:', role_name || role_id, 'name:', userName);
    
    setToken(newToken);
    setUsername(user);
    setName(userName);
    setRoleId(role_id || null);
    setRoleName(role_name || null);
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_username', user);
    localStorage.setItem('auth_name', userName || '');
    localStorage.removeItem('auth_is_staff');
    if (role_id) {
      localStorage.setItem('auth_role_id', role_id);
    } else {
      localStorage.removeItem('auth_role_id');
    }
    if (role_name) {
      localStorage.setItem('auth_role_name', role_name);
    } else {
      localStorage.removeItem('auth_role_name');
    }
    if (domain !== undefined) {
      localStorage.setItem('auth_domain', domain);
      setDomain(domain);
    }
    
    // Immediately set the token in axios headers
    api.defaults.headers.common['Authorization'] = `Token ${newToken}`;
    console.log('AuthContext: Token set in axios headers');
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    setName(null);
    setDomain(null);
    setRoleId(null);
    setRoleName(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_name');
    localStorage.removeItem('auth_domain');
    localStorage.removeItem('auth_role_id');
    localStorage.removeItem('auth_role_name');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        name,
        domain,
        roleId,
        roleName,
        isAdmin,
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
