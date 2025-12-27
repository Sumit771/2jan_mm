import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
    Box, Typography, Paper, Tabs, Tab, Grid, Card, CardContent,
    TextField, Button, Alert, CircularProgress
} from '@mui/material';
import { WarningAmber as WarningIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';

const OverdueOrders = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState('3days');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState({}); // { orderId: 'message' }
    const [sending, setSending] = useState({}); // { orderId: boolean }

    useEffect(() => {
        const q = query(collection(db, 'orders'), where('status', 'in', ['pending', 'in-progress']));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOrders(fetchedOrders);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching overdue orders:", error);
            toast.error("Failed to load orders.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleMessageChange = (orderId, value) => {
        setMessages(prev => ({ ...prev, [orderId]: value }));
    };

    const handleSendNotification = async (order) => {
        const message = messages[order.id];
        if (!message) {
            toast.warn("Please enter a notification message.");
            return;
        }

        if (!order.assignedEditorEmails || order.assignedEditorEmails.length === 0) {
            toast.error("No editor assigned to this order.");
            return;
        }

        setSending(prev => ({ ...prev, [order.id]: true }));

        try {
            const notificationPromises = order.assignedEditorEmails.map(email => {
                return addDoc(collection(db, 'notifications'), {
                    recipientEmail: email,
                    senderName: user.displayName || 'Team Leader',
                    message: message,
                    orderName: order.name,
                    orderId: order.id,
                    type: 'danger', // Special type for this notification
                    createdAt: serverTimestamp(),
                    read: false,
                });
            });

            await Promise.all(notificationPromises);
            toast.success(`Notification sent to ${order.assignedEditorNames.join(', ')}`);
            handleMessageChange(order.id, ''); // Clear message after sending
        } catch (error) {
            console.error("Error sending notification:", error);
            toast.error("Failed to send notification.");
        } finally {
            setSending(prev => ({ ...prev, [order.id]: false }));
        }
    };

    const filterOrders = (days) => {
        const now = new Date();
        return orders.filter(order => {
            if (!order.createdAt?.toDate) return false;
            const orderDate = order.createdAt.toDate();
            const diffTime = Math.abs(now - orderDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (days === 30) {
                return diffDays >= 30;
            }
            if (days === 3) {
                return diffDays >= 3 && diffDays < 30;
            }
            return false;
        });
    };

    const orders3Days = filterOrders(3);
    const orders30Days = filterOrders(30);
    const currentOrders = tab === '3days' ? orders3Days : orders30Days;
    const daysText = tab === '3days' ? '3+ Days' : '30+ Days';

    if (loading) {
        return <CircularProgress />;
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>Overdue Orders</Typography>
            <Paper sx={{ mb: 3 }}>
                <Tabs value={tab} onChange={(e, newValue) => setTab(newValue)} centered>
                    <Tab label={`3+ Days Old (${orders3Days.length})`} value="3days" />
                    <Tab label={`30+ Days Old (${orders30Days.length})`} value="30days" />
                </Tabs>
            </Paper>

            <Box>
                {currentOrders.length === 0 ? (
                    <Alert severity="success">No orders are overdue for this period.</Alert>
                ) : (
                    <Grid container spacing={3}>
                        {currentOrders.map(order => (
                            <Grid item xs={12} md={6} key={order.id}>
                                <Card sx={{ borderLeft: '5px solid #d32f2f', height: '100%' }}>
                                    <CardContent>
                                        <Box display="flex" alignItems="center" mb={2}>
                                            <WarningIcon color="error" sx={{ mr: 1 }} />
                                            <Typography variant="h6" color="error.main" sx={{ textTransform: 'capitalize' }}>
                                                This order is {order.status} for over {daysText}!
                                            </Typography>
                                        </Box>
                                        <Typography variant="body1" gutterBottom>
                                            <strong>Order:</strong> {order.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            <strong>Assigned Editor:</strong> {order.assignedEditorNames?.join(', ') || 'N/A'}
                                        </Typography>
                                        <Box mt={2} display="flex" gap={2}>
                                            <TextField
                                                label="Notification Message"
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                                value={messages[order.id] || ''}
                                                onChange={(e) => handleMessageChange(order.id, e.target.value)}
                                            />
                                            <Button
                                                variant="contained"
                                                color="error"
                                                onClick={() => handleSendNotification(order)}
                                                disabled={sending[order.id]}
                                                sx={{ whiteSpace: 'nowrap' }}
                                            >
                                                {sending[order.id] ? <CircularProgress size={24} color="inherit" /> : 'Send Alert'}
                                            </Button>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Box>
        </Box>
    );
};

export default OverdueOrders;