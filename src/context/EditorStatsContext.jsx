// src/context/EditorStatsContext.jsx
import React, { useState, useEffect, createContext, useContext } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const EditorStatsContext = createContext();

export const EditorStatsProvider = ({ children }) => {
    const { user, role } = useAuth();
    const [editorStats, setEditorStats] = useState([]);
    const [loading, setLoading] = useState(true);

    // Load from localStorage on mount
    useEffect(() => {
        const cached = localStorage.getItem('editorStats');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setEditorStats(Object.values(parsed));
            } catch (error) {
                console.error('Error parsing cached editor stats:', error);
            }
        }
    }, []);

    // Calculate stats from orders
    useEffect(() => {
        if (!user) return;

        const editors = ['tarun@mm.com', 'harinder@mm.com', 'roop@mm.com', 'gurwinder@mm.com'];

        if (role === 'team-leader') {
            // Listen to orders collection and calculate stats dynamically
            const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
                const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Calculate stats for each editor
                const stats = editors.map(email => {
                    const editorOrders = orders.filter(order =>
                        order.assignedToEmail === email || order.assignedToName === email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1)
                    );

                    const totalAssigned = editorOrders.length;
                    const totalCompleted = editorOrders.filter(order => order.status === 'completed').length;
                    const currentWorkload = editorOrders.filter(order => order.status === 'pending' || order.status === 'in-progress').length;

                    // Calculate completed orders with timestamps
                    const completedOrders = editorOrders
                        .filter(order => order.status === 'completed' && order.completedAt)
                        .map(order => ({
                            id: order.id,
                            completedAt: order.completedAt,
                            assignedAt: order.createdAt
                        }))
                        .sort((a, b) => b.completedAt.seconds - a.completedAt.seconds);

                    // Calculate monthly stats
                    const monthlyStats = {};
                    editorOrders.forEach(order => {
                        if (order.createdAt) {
                            const month = new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                            if (!monthlyStats[month]) {
                                monthlyStats[month] = { assigned: 0, completed: 0 };
                            }
                            monthlyStats[month].assigned++;
                            if (order.status === 'completed') {
                                monthlyStats[month].completed++;
                            }
                        }
                    });

                    // Calculate recent activity (last 10 actions)
                    const recentActivity = [];
                    completedOrders.slice(0, 5).forEach(order => {
                        recentActivity.push({
                            description: `Completed order for ${order.id}`,
                            timestamp: order.completedAt
                        });
                    });

                    return {
                        email,
                        name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
                        totalAssigned,
                        totalCompleted,
                        currentWorkload,
                        monthlyStats,
                        completedOrders,
                        recentActivity,
                        createdAt: new Date()
                    };
                });

                setEditorStats(stats);
                localStorage.setItem('editorStats', JSON.stringify(stats.reduce((acc, stat) => {
                    acc[stat.email] = stat;
                    return acc;
                }, {})));
                // console.log('EditorStatsContext - Calculated stats from orders:', stats);
                setLoading(false);
            });

            return unsubscribe;
        } else {
            // For editors, calculate their own stats
            const unsubscribe = onSnapshot(
                collection(db, 'orders'),
                (snapshot) => {
                    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const editorOrders = orders.filter(order => order.assignedToEmail === user.email);

                    const totalAssigned = editorOrders.length;
                    const totalCompleted = editorOrders.filter(order => order.status === 'completed').length;
                    const currentWorkload = editorOrders.filter(order => order.status === 'pending' || order.status === 'in-progress').length;

                    const completedOrders = editorOrders
                        .filter(order => order.status === 'completed' && order.completedAt)
                        .map(order => ({
                            id: order.id,
                            completedAt: order.completedAt,
                            assignedAt: order.createdAt
                        }))
                        .sort((a, b) => b.completedAt.seconds - a.completedAt.seconds);

                    const monthlyStats = {};
                    editorOrders.forEach(order => {
                        if (order.createdAt) {
                            const month = new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                            if (!monthlyStats[month]) {
                                monthlyStats[month] = { assigned: 0, completed: 0 };
                            }
                            monthlyStats[month].assigned++;
                            if (order.status === 'completed') {
                                monthlyStats[month].completed++;
                            }
                        }
                    });

                    const recentActivity = [];
                    completedOrders.slice(0, 5).forEach(order => {
                        recentActivity.push({
                            description: `Completed order for ${order.id}`,
                            timestamp: order.completedAt
                        });
                    });

                    const stats = [{
                        email: user.email,
                        name: user.email.split('@')[0],
                        totalAssigned,
                        totalCompleted,
                        currentWorkload,
                        monthlyStats,
                        completedOrders,
                        recentActivity,
                        createdAt: new Date()
                    }];

                    setEditorStats(stats);
                    localStorage.setItem('editorStats', JSON.stringify(stats.reduce((acc, stat) => {
                        acc[stat.email] = stat;
                        return acc;
                    }, {})));
                    setLoading(false);
                }
            );

            return unsubscribe;
        }
    }, [user, role]);

    const refreshStats = () => {
        // Force a refresh by clearing cache and reloading
        localStorage.removeItem('editorStats');
        setEditorStats([]);
        setLoading(true);
        // The useEffect will automatically recalculate
    };

    const value = {
        editorStats,
        loading,
        refreshStats
    };

    return (
        <EditorStatsContext.Provider value={value}>
            {children}
        </EditorStatsContext.Provider>
    );
};

export const useEditorStats = () => {
    const context = useContext(EditorStatsContext);
    if (!context) {
        throw new Error('useEditorStats must be used within an EditorStatsProvider');
    }
    return context;
};