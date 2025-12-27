import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    IconButton,
    Badge,
    Menu,
    MenuItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Typography,
    Box,
    Divider,
    Button,
    List,
    ListItem,
    Paper
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    CheckCircle as CheckCircleIcon,
    Edit as EditIcon,
    PlayArrow as PlayArrowIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const NotificationCenter = ({ fullPage = false, onNotificationClick }) => {
    const { user, isTeamLeader } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const open = Boolean(anchorEl);
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (!user) return;

        // Listen to orders collection for changes
        const q = isTeamLeader
            ? query(collection(db, 'orders'))
            : query(collection(db, 'orders'), where('assignedEditorEmails', 'array-contains', user.email));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (isInitialMount.current) {
                isInitialMount.current = false;
                return;
            }

            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified' || change.type === 'added') {
                    const data = change.doc.data();

                    let type = 'update';
                    let title = 'Status Updated';

                    if (change.type === 'added') {
                        type = 'assigned';
                        title = isTeamLeader ? 'New Order Assigned' : 'New Order Assigned by Team Leader';
                    } else if (data.status === 'completed') {
                        type = 'completed';
                        title = 'Order Completed';
                    } else if (data.status === 'in-progress') {
                        type = 'accepted';
                        title = 'Order Accepted';
                    } else {
                        type = 'update';
                        title = isTeamLeader ? 'Order Details Updated' : 'Order Details Updated by Team Leader';
                    }

                    // Construct notification object
                    const newNotification = {
                        id: Date.now() + Math.random(), // Ephemeral ID
                        orderId: change.doc.id,
                        orderName: data.name || 'Unnamed Order',
                        EditorName: data.assignedEditorNames || 'Unknown Editor',

                        editor: data.assignedEditorEmails ? data.assignedEditorEmails.join(', ') : 'Unassigned',
                        status: data.status,
                        timestamp: new Date(),
                        type: type,
                        title: title
                    };

                    setNotifications(prev => [newNotification, ...prev]);
                    setUnreadCount(prev => prev + 1);
                }
            });
        });

        return () => {
            unsubscribe();
            isInitialMount.current = true;
        };
    }, [user, isTeamLeader]);

    // Listen for manually pushed notifications
    useEffect(() => {
        if (!user?.email) return;

        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('recipientEmail', '==', user.email),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const newNotification = {
                        id: change.doc.id,
                        orderId: data.orderId,
                        orderName: data.orderName,
                        editor: `From: ${data.senderName}`,
                        status: data.message,
                        timestamp: data.createdAt?.toDate() || new Date(),
                        type: data.type, // 'danger'
                        title: 'Manual Alert'
                    };
                    setNotifications(prev => [newNotification, ...prev]);
                    if (!open) setUnreadCount(prev => prev + 1);
                }
            });
        });

        return () => unsubscribe();
    }, [user, open]);

    useEffect(() => {
        if (fullPage) {
            setUnreadCount(0);
        }
    }, [fullPage, notifications]);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
        setUnreadCount(0); // Mark as read when opened
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleClear = () => {
        setNotifications([]);
        setUnreadCount(0);
        handleClose();
    };

    const handleNotificationClick = (notification) => {
        handleClose();
        if (onNotificationClick && notification.orderId) {
            onNotificationClick(notification.orderId);
        }
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const sortedNotifications = useMemo(() => [...notifications].sort((a, b) => b.timestamp - a.timestamp), [notifications]);

    if (fullPage) {
        return (
            <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" fontWeight="bold">Notifications</Typography>
                    {notifications.length > 0 && (
                        <Button variant="outlined" color="error" onClick={handleClear}>
                            Clear All
                        </Button>
                    )}
                </Box>
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <List sx={{ p: 0 }}>
                        {notifications.length === 0 ? (
                            <ListItem sx={{ p: 3, justifyContent: 'center' }}>
                                <Typography color="text.secondary">No new notifications</Typography>
                            </ListItem>
                        ) : (
                            sortedNotifications.map((notification, index) => (
                                <React.Fragment key={notification.id}>
                                    <ListItem 
                                        alignItems="flex-start" 
                                        sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <ListItemAvatar>
                                            <Avatar sx={{ bgcolor: notification.type === 'danger' ? 'error.light' : notification.type === 'completed' ? 'success.light' : (notification.type === 'accepted' ? 'warning.light' : 'info.light') }}>
                                                {notification.type === 'danger' ? <WarningIcon /> : notification.type === 'completed' ? <CheckCircleIcon /> : (notification.type === 'accepted' ? <PlayArrowIcon /> : <EditIcon />)}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                                    {notification.title}
                                                </Typography>
                                            }
                                            secondary={
                                                <Box component="span" sx={{ mt: 0.5, display: 'block' }}>
                                                    <Typography component="span" variant="body2" color="text.primary" display="block">
                                                        {notification.orderName} {notification.clientName && `(${notification.clientName})`}
                                                    </Typography>
                                                    <Typography component="span" variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                                        Editor: {notification.editor}
                                                    </Typography>
                                                    <Typography component="span" variant="caption" color="text.secondary">
                                                        {formatTime(notification.timestamp)} • Status: {notification.status}
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </ListItem>
                                    {index < sortedNotifications.length - 1 && <Divider component="li" />}
                                </React.Fragment>
                            ))
                        )}
                    </List>
                </Paper>
            </Box>
        );
    }

    return (
        <>
            <IconButton color="inherit" onClick={handleClick}>
                <Badge badgeContent={unreadCount} color="error">
                    <NotificationsIcon />
                </Badge>
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    style: {
                        maxHeight: 400,
                        width: 360,
                    },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Notifications</Typography>
                    {notifications.length > 0 && (
                        <Button size="small" onClick={handleClear}>Clear</Button>
                    )}
                </Box>
                <Divider />
                {notifications.length === 0 ? (
                    <MenuItem disabled>
                        <ListItemText primary="No new notifications" />
                    </MenuItem>
                ) : (
                    sortedNotifications.map((notification) => (
                        <MenuItem key={notification.id} onClick={() => handleNotificationClick(notification)} sx={{ whiteSpace: 'normal', alignItems: 'flex-start' }}>
                            <ListItemAvatar sx={{ mt: 0.5 }}>
                                <Avatar sx={{ bgcolor: notification.type === 'danger' ? 'error.light' : notification.type === 'completed' ? 'success.light' : (notification.type === 'accepted' ? 'warning.light' : 'info.light') }}>
                                    {notification.type === 'danger' ? <WarningIcon /> : notification.type === 'completed' ? <CheckCircleIcon /> : (notification.type === 'accepted' ? <PlayArrowIcon /> : <EditIcon />)}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                        {notification.title}
                                    </Typography>
                                }
                                secondary={
                                    <Box component="span">
                                        <Typography component="span" variant="body2" color="text.primary" display="block">
                                            {notification.orderName} {notification.clientName && `(${notification.clientName})`}
                                        </Typography>
                                        <Typography component="span" variant="caption" color="text.secondary" display="block">
                                            Editor: {notification.editor}
                                        </Typography>
                                        <Typography component="span" variant="caption" color="text.secondary">
                                            {formatTime(notification.timestamp)} • Status: {notification.status}
                                        </Typography>
                                    </Box>
                                }
                            />
                        </MenuItem>
                    ))
                )}
            </Menu>
        </>
    );
};

export default NotificationCenter;