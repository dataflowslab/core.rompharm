import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';

interface AuthContextType {
  token: string | null;
  username: string | null;
  name: string | null;
  userId: string | null;
  roleId: string | null;
  roleSlug: string | null;
  locations: string[];
  roleSections: Record<string, string[]>;
  roleMenuItems: any[];
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
  const [userId, setUserId] = useState<string | null>(
    localStorage.getItem('auth_user_id')
  );
  const [roleId, setRoleId] = useState<string | null>(
    localStorage.getItem('auth_role_id')
  );
  const [roleSlug, setRoleSlug] = useState<string | null>(
    localStorage.getItem('auth_role_slug')
  );
  const [locations, setLocations] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('auth_locations');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [roleSections, setRoleSections] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem('auth_role_sections');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [roleMenuItems, setRoleMenuItems] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('auth_role_menu_items');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Token ${token}`;

      // Verify token and load user info (including name/role)
      api.get('/api/auth/me')
        .then(response => {
          const data = response.data || {};
          if (data.username) {
            setUsername(data.username);
            localStorage.setItem('auth_username', data.username);
          }
          if (data.name) {
            setName(data.name);
            localStorage.setItem('auth_name', data.name);
          }
          if (data._id) {
            setUserId(data._id);
            localStorage.setItem('auth_user_id', data._id);
          }
          if (data.role_id || data.role) {
            const roleValue = data.role_id || data.role;
            setRoleId(roleValue);
            localStorage.setItem('auth_role_id', roleValue);
          }
          if (data.role_slug) {
            setRoleSlug(data.role_slug);
            localStorage.setItem('auth_role_slug', data.role_slug);
          }
          if (Array.isArray(data.locations)) {
            setLocations(data.locations);
            localStorage.setItem('auth_locations', JSON.stringify(data.locations));
          }
          if (data.role_sections && typeof data.role_sections === 'object') {
            setRoleSections(data.role_sections || {});
            localStorage.setItem('auth_role_sections', JSON.stringify(data.role_sections || {}));
          }
          if (Array.isArray(data.role_menu_items)) {
            setRoleMenuItems(data.role_menu_items || []);
            localStorage.setItem('auth_role_menu_items', JSON.stringify(data.role_menu_items || []));
          }
        })
        .catch(error => {
          console.error('Failed to verify token:', error);
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
    const { token: newToken, username: user, name: userName } = response.data;
    
    console.log('AuthContext: Login successful, token:', newToken?.substring(0, 20) + '...', 'name:', userName);
    
    setToken(newToken);
    setUsername(user);
    setName(userName);
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_username', user);
    localStorage.setItem('auth_name', userName || '');
    
    // Immediately set the token in axios headers
    api.defaults.headers.common['Authorization'] = `Token ${newToken}`;
    console.log('AuthContext: Token set in axios headers');

    // Load additional user info (role, id)
    try {
      const meResponse = await api.get('/api/auth/me');
      const data = meResponse.data || {};
      if (data.username) {
        setUsername(data.username);
        localStorage.setItem('auth_username', data.username);
      }
      if (data._id) {
        setUserId(data._id);
        localStorage.setItem('auth_user_id', data._id);
      }
      if (data.role_id || data.role) {
        const roleValue = data.role_id || data.role;
        setRoleId(roleValue);
        localStorage.setItem('auth_role_id', roleValue);
      }
      if (data.role_slug) {
        setRoleSlug(data.role_slug);
        localStorage.setItem('auth_role_slug', data.role_slug);
      }
      if (Array.isArray(data.locations)) {
        setLocations(data.locations);
        localStorage.setItem('auth_locations', JSON.stringify(data.locations));
      }
      if (data.role_sections && typeof data.role_sections === 'object') {
        setRoleSections(data.role_sections || {});
        localStorage.setItem('auth_role_sections', JSON.stringify(data.role_sections || {}));
      }
      if (Array.isArray(data.role_menu_items)) {
        setRoleMenuItems(data.role_menu_items || []);
        localStorage.setItem('auth_role_menu_items', JSON.stringify(data.role_menu_items || []));
      }
    } catch (error) {
      console.error('AuthContext: Failed to load user details after login:', error);
    }
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    setName(null);
    setUserId(null);
    setRoleId(null);
    setRoleSlug(null);
    setLocations([]);
    setRoleSections({});
    setRoleMenuItems([]);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    localStorage.removeItem('auth_name');
    localStorage.removeItem('auth_user_id');
    localStorage.removeItem('auth_role_id');
    localStorage.removeItem('auth_role_slug');
    localStorage.removeItem('auth_locations');
    localStorage.removeItem('auth_role_sections');
    localStorage.removeItem('auth_role_menu_items');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        name,
        userId,
        roleId,
        roleSlug,
        locations,
        roleSections,
        roleMenuItems,
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
