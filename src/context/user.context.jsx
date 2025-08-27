import React, { createContext, useState, useEffect } from 'react';
import axios from '../config/axios';

// Create the UserContext
export const UserContext = createContext();

// Create a provider component
export const UserProvider = ({ children }) => {
    const [ user, setUser ] = useState(null);
    const [ loading, setLoading ] = useState(true);

    // Function to restore user session from token
    const restoreUserSession = async () => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (token) {
            try {
                // Verify token with backend
                const response = await axios.get('/users/profile');
                setUser(response.data.user);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            } catch (error) {
                console.error('Token verification failed:', error);
                // If API call fails but we have stored user data, use it temporarily
                if (storedUser) {
                    try {
                        const parsedUser = JSON.parse(storedUser);
                        setUser(parsedUser);
                        console.log('Using stored user data as fallback');
                    } catch (parseError) {
                        console.error('Failed to parse stored user data:', parseError);
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        setUser(null);
                    }
                } else {
                    // Clear invalid token
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            }
        } else if (storedUser) {
            // If no token but stored user, clear it
            localStorage.removeItem('user');
            setUser(null);
        }
        setLoading(false);
    };

    // Initialize user session on app load
    useEffect(() => {
        restoreUserSession();
    }, []);

    // Function to update user and persist to localStorage
    const updateUser = (userData) => {
        setUser(userData);
        if (userData) {
            localStorage.setItem('user', JSON.stringify(userData));
        } else {
            localStorage.removeItem('user');
        }
    };

    // Function to logout
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <UserContext.Provider value={{ 
            user, 
            setUser: updateUser, 
            logout, 
            loading,
            restoreUserSession 
        }}>
            {children}
        </UserContext.Provider>
    );
};