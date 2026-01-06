import React, { useEffect, useState, useRef, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, getDoc, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
    Box,
    Container,
    Typography,
    Grid,
    Paper,
    Chip,
    CircularProgress,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    IconButton,
    useTheme,
    useMediaQuery,
    Tabs,
    Tab,
    TextField,
    InputAdornment,
    Alert,
    Avatar,
    LinearProgress
} from '@mui/material';
import { Lock as LockIcon, Close as CloseIcon, CheckCircle as CheckCircleIcon, Search as SearchIcon, WarningAmber as WarningIcon, Edit as EditIcon, CloudUpload as CloudUploadIcon } from '@mui/icons-material';
//import EditorStats from './EditorStats';
import MonthlyTargetProgress from './MonthlyTargetProgress';

const EditorEditOrderDialog = ({ open, onClose, order, onSave }) => {
    const [form, setForm] = useState({ name: '', telecaller: '', remark: '', sampleImageUrl: '' });
    const [file, setFile] = useState(null);

    useEffect(() => {
        if (order) {
            setForm({
                name: order.name || '',
                telecaller: order.telecaller || '',
                remark: order.remark || '',
                sampleImageUrl: order.sampleImageUrl || ''
            });
            setFile(null);
        }
    }, [order]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSave = () => {
        onSave(form, file);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit Order Details</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <TextField label="Client/Order Name" name="name" value={form.name} onChange={handleChange} fullWidth />
                    <TextField label="Telecaller" name="telecaller" value={form.telecaller} onChange={handleChange} fullWidth />
                    <TextField label="Remark" name="remark" value={form.remark} onChange={handleChange} fullWidth multiline rows={3} />
                    <TextField label="Image URL" name="sampleImageUrl" value={form.sampleImageUrl} onChange={handleChange} fullWidth />
                    <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} fullWidth>
                        Upload New Image
                        <input type="file" hidden onChange={(e) => setFile(e.target.files[0])} />
                    </Button>
                    {file && <Typography variant="caption">{file.name}</Typography>}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained">Save Changes</Button>
            </DialogActions>
        </Dialog>
    );
};

const EditorDashboard = ({ highlightOrderId, onClearHighlight }) => {
    const { user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('active');
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [timeFilter, setTimeFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [mainTab, setMainTab] = useState('tasks');

    // State for confirmation dialog
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmStep, setConfirmStep] = useState(0);
    const [targetOrder, setTargetOrder] = useState(null);

    // State for Details Modal
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [messages, setMessages] = useState({}); // { orderId: 'message' }
    const [sending, setSending] = useState({}); // { orderId: boolean }
    const [canSeeStats, setCanSeeStats] = useState(false);
    const [canAutoApprove, setCanAutoApprove] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const isInitialMount = useRef(true);

    // Listen for user permissions (allowSeeStats)
    useEffect(() => {
        if (!user?.uid) return;

        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const userData = docSnapshot.data();
                setCanSeeStats(userData.allowSeeStats === true);
                setCanAutoApprove(userData.autoApproveEdits === true);
            }
        }, (error) => {
            console.error("Error fetching user permissions:", error);
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        if (!user?.email) return;

        // Query orders where assignedEditorEmails contains the user's email
        const q = query(
            collection(db, 'orders'),
            where('assignedEditorEmails', 'array-contains', user.email)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!isInitialMount.current) {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        if (data.assignmentType === 'broadcast') {
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                            audio.play().catch(() => { });
                            toast.info("New Broadcast Order Available!");
                        }
                    }
                });
            }

            const fetchedOrders = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            // Deduplicate orders to prevent "same key" warnings in React
            const uniqueOrders = Array.from(new Map(fetchedOrders.map(item => [item.id, item])).values());

            // Sort by createdAt descending (newest first)
            // Doing this client-side avoids complex Firestore composite index requirements
            uniqueOrders.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });

            setOrders(uniqueOrders);
            setLoading(false);
            isInitialMount.current = false;
        }, (error) => {
            console.error("Error fetching orders:", error);
            toast.error("Error loading orders. Please check permissions.");
            setLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, [user]);

    useEffect(() => {
        if (highlightOrderId && orders.length > 0) {
            const order = orders.find(o => o.id === highlightOrderId);
            if (order) {
                setSelectedOrder(order);
                setDetailsOpen(true);
                if (onClearHighlight) onClearHighlight();
            }
        }
    }, [highlightOrderId, orders, onClearHighlight]);

    const handleAcceptOrder = async (order) => {
        if (!user) return;
        try {
            const orderRef = doc(db, 'orders', order.id);

            // Fetch user profile to get the correct display name
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : null;
            const editorName = userData?.displayName || user.displayName || user.email.split('@')[0];
            const updateData = {
                status: 'in-progress',
                acceptedAt: serverTimestamp(),
            };

            if (order.assignmentType === 'broadcast') {
                updateData.assignedEditorEmails = [user.email];
                updateData.assignedEditorNames = [editorName];
                updateData.assignmentType = 'direct';
            }

            await updateDoc(orderRef, updateData);
            toast.success("Order accepted! You can now start working.");
            setFilter('active');
        } catch (error) {
            console.error("Error accepting order:", error);
            toast.error("Failed to accept order.");
        }
    };

    const handleSendNotificationToTL = async (order, overdueText) => {
        const message = messages[order.id];
        if (!message) {
            toast.warn("Please enter a message for the Team Leader.");
            return;
        }

        setSending(prev => ({ ...prev, [order.id]: true }));

        try {
            const tlQuery = query(collection(db, 'users'), where('role', '==', 'team-leader'));
            const tlSnapshot = await getDocs(tlQuery);
            const teamLeaders = tlSnapshot.docs.map(doc => doc.data());

            if (teamLeaders.length === 0) {
                toast.error("No Team Leaders found to notify.");
                return;
            }

            const notificationPromises = teamLeaders.map(leader => {
                return addDoc(collection(db, 'notifications'), {
                    recipientEmail: leader.email,
                    senderName: user.displayName || user.email,
                    message: `[${overdueText} Alert] ${message}`,
                    orderName: order.name,
                    orderId: order.id,
                    type: 'danger',
                    createdAt: serverTimestamp(),
                    read: false,
                });
            });

            await Promise.all(notificationPromises);
            toast.success(`Alert sent to Team Leaders.`);
            setMessages(prev => ({ ...prev, [order.id]: '' }));
        } catch (error) {
            console.error("Error sending notification:", error);
            toast.error("Failed to send notification.");
        } finally {
            setSending(prev => ({ ...prev, [order.id]: false }));
        }
    };

    const handleStatusChange = async (orderId, newStatus) => {
        if (newStatus === 'completed') {
            setTargetOrder(orderId);
            setConfirmStep(1);
            setConfirmOpen(true);
        } else {
            await updateStatus(orderId, newStatus);
        }
    };

    const updateStatus = async (orderId, newStatus) => {
        try {
            const orderRef = doc(db, 'orders', orderId);
            const order = orders.find(o => o.id === orderId);
            const isShared = order.assignedEditorEmails && order.assignedEditorEmails.length > 1;

            let updateData = {};

            if (isShared) {
                if (newStatus === 'completed') {
                    // Add user to completedBy array
                    updateData.completedBy = arrayUnion(user.email);

                    // Check if this action completes the order for everyone
                    const currentCompleted = order.completedBy || [];
                    // We use a Set to count unique completed emails including the current user
                    const uniqueCompleted = new Set([...currentCompleted, user.email]);

                    if (uniqueCompleted.size >= order.assignedEditorEmails.length) {
                        updateData.status = 'completed';
                        updateData.completedAt = serverTimestamp();
                    } else {
                        updateData.status = 'in-progress';
                        updateData.completedAt = null;
                    }
                } else {
                    // Reverting to pending or in-progress
                    updateData.completedBy = arrayRemove(user.email);

                    // If other editors have completed it, keep global status as in-progress
                    const currentCompleted = order.completedBy || [];
                    const othersCompleted = currentCompleted.filter(email => email !== user.email);

                    updateData.status = othersCompleted.length > 0 ? 'in-progress' : newStatus;
                    updateData.completedAt = null;
                }
            } else {
                // Single editor logic
                updateData.status = newStatus;
                updateData.completedAt = newStatus === 'completed' ? serverTimestamp() : null;
            }

            await updateDoc(orderRef, updateData);
            toast.success(`Order status updated to ${newStatus}`);
        } catch (err) {
            console.error("Failed to update status", err);
            toast.error("Failed to update status");
        }
    };

    const handleConfirm = () => {
        if (confirmStep === 1) {
            setConfirmStep(2);
        } else {
            updateStatus(targetOrder, 'completed');
            handleClose();
        }
    };

    const handleClose = () => {
        setConfirmOpen(false);
        setConfirmStep(0);
        setTargetOrder(null);
    };

    const handleOpenDetails = (order) => {
        setSelectedOrder(order);
        setDetailsOpen(true);
    };

    const handleCloseDetails = () => {
        setDetailsOpen(false);
        setSelectedOrder(null);
    };

    const handleEditClick = (order) => {
        setEditingOrder(order);
        setEditDialogOpen(true);
    };

    const handleEditSave = async (formData, file) => {
        if (!editingOrder) return;
        try {
            let imageUrl = formData.sampleImageUrl;
            if (file) {
                const storageRef = ref(storage, `samples/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                imageUrl = await getDownloadURL(storageRef);
            }

            const changes = {
                name: formData.name,
                telecaller: formData.telecaller,
                remark: formData.remark,
                sampleImageUrl: imageUrl
            };

            const orderRef = doc(db, 'orders', editingOrder.id);
            const editorName = user.displayName || user.email.split('@')[0] || 'Unknown';

            if (canAutoApprove) {
                // Direct update
                await updateDoc(orderRef, changes);
                // Log modification
                try {
                    await addDoc(collection(db, `orders/${editingOrder.id}/history`), {
                        action: 'edit',
                        editedBy: user.email,
                        editorName: editorName,
                        changes: changes,
                        timestamp: serverTimestamp(),
                        autoApproved: true
                    });
                } catch (historyError) {
                    console.error("Error logging history:", historyError);
                }
                toast.success("Order updated successfully!");
            } else {
                // Send for approval
                await updateDoc(orderRef, {
                    hasPendingEdit: true,
                    pendingEdit: { changes, editorEmail: user.email, editorName: editorName, timestamp: new Date() }
                });
                toast.info("Changes sent to Team Leader for approval.");
            }
            setEditDialogOpen(false);
        } catch (error) {
            console.error("Error updating order:", error);
            toast.error("Failed to update order.");
        }
    };

    const filteredOrders = orders.filter(order => {
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : null;
        if (!orderDate) return false;

        // Overdue Tabs Logic
        if (timeFilter === '3_days_old' || timeFilter === '30_days_old') {
            if (order.status === 'completed') return false; // Only show pending/in-progress
            const now = new Date();
            const diffTime = Math.abs(now - orderDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (timeFilter === '3_days_old' && (diffDays < 3 || diffDays >= 30)) return false;
            if (timeFilter === '30_days_old' && diffDays < 30) return false;
        } else {
            // Regular Status Filter
            if (filter === 'pending' && order.status !== 'pending') return false;
            if (filter === 'active' && order.status !== 'in-progress') return false;
            if (filter === 'completed' && order.status !== 'completed') return false;
        }

        // 2. Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const nameMatch = order.name?.toLowerCase().includes(query);
            const telecallerMatch = order.telecaller?.toLowerCase().includes(query);
            if (!nameMatch && !telecallerMatch) return false;
        }

        // 3. Date Filter
        if (startDate || endDate) {
            if (startDate && orderDate < new Date(startDate + "T00:00:00")) return false;
            if (endDate && orderDate > new Date(endDate + "T23:59:59")) return false;
        } else if (timeFilter !== 'all' && timeFilter !== '3_days_old' && timeFilter !== '30_days_old') {
            // This part is for potential future filters like 'last 7 days' etc.
        }

        return true;
    });

    const getEditorStatus = (order) => {
        const isShared = order.assignedEditorEmails?.length > 1;
        if (isShared) {
            if (order.completedBy?.includes(user.email)) return 'completed';
            if (order.status === 'completed') return 'completed';
            return order.status;
        }
        return order.status;
    };

    const isBroadcast = (order) => order.assignmentType === 'broadcast';

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent': return 'error';
            case 'high': return 'warning';
            default: return 'default';
        }
    };

    const currentMonthStats = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return orders.reduce((acc, order) => {
            const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : null;
            if (orderDate && orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
                acc.total++;

                // Check if completed specifically by this user (handling shared orders)
                let isCompleted = order.status === 'completed';
                if (order.assignedEditorEmails?.length > 1 && order.completedBy?.includes(user?.email)) {
                    isCompleted = true;
                }

                if (isCompleted) {
                    acc.completed++;
                } else {
                    acc.active++;
                }
            }
            return acc;
        }, { total: 0, completed: 0, active: 0 });
    }, [orders, user]);

    const currentMonthName = new Date().toLocaleString('default', { month: 'short' });

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        // <Container sx={{ mt: -2, mb: 4, px: 2, width: '80vw' }}>
        <Container
            maxWidth={false}
            sx={{
                mt: -2,
                mb: 4,
                px: 2,
                width: {
                    xs: '93vw',   // mobile
                    sm: '93vw',   // tablet
                    md: '78vw',    // desktop
                },
                ml: {
                    md: 'auto',    // aligns content after navbar
                },
            }}
        >



            <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="flex-start" mb={4}>
                <Box display="flex" alignItems="center" gap={2}>
                    {/* <Typography variant="h4" fontWeight={700}>
                    My Tasks
                </Typography> */}
                    <MonthlyTargetProgress currentMonthCompleted={currentMonthStats.completed} />
                    {user?.displayName && (
                        <Typography variant="h5" color="text.secondary" fontWeight={500}>
                            - {user.displayName}
                        </Typography>

                    )}
                </Box>

                <Box display="flex" gap={4} mt={{ xs: 2, md: 0 }} textAlign="right">
                    <Box>

                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            Orders ({currentMonthName})
                        </Typography>
                        <Typography variant="h4" fontWeight={600} color="text.primary">
                            {currentMonthStats.total}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            Completed
                        </Typography>
                        <Typography variant="h4" fontWeight={700} color="success.main">
                            {currentMonthStats.completed}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                            Active
                        </Typography>
                        <Typography variant="h4" fontWeight={700} color="warning.main">
                            {currentMonthStats.active}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={mainTab} onChange={(e, v) => setMainTab(v)}>
                    <Tab label="My Tasks" value="tasks" />
                    {canSeeStats && <Tab label="Statistics" value="stats" />}
                </Tabs>
            </Box> */}
            {/* 
            {mainTab === 'stats' && canSeeStats && (
                <EditorStats orders={orders} userEmail={user?.email} />
            )} */}

            {mainTab === 'tasks' && (
                <>
                    <Box mb={4} sx={{ display: 'flex', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
                        <ToggleButtonGroup
                            color="primary"
                            value={filter}
                            exclusive
                            onChange={(e, newFilter) => {
                                if (newFilter !== null) setFilter(newFilter);
                            }}
                            aria-label="Order Status Filter"
                        >
                            <ToggleButton value="pending">Pending</ToggleButton>
                            <ToggleButton value="active">Active</ToggleButton>
                            <ToggleButton value="completed">Completed</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, flexWrap: 'wrap' }}>
                        <TextField
                            label="Search by Client or Telecaller"
                            variant="outlined"
                            size="small"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ flexGrow: 1, width: { xs: '100%', sm: 'auto' }, bgcolor: 'background.paper', borderRadius: 1 }}
                        />
                        <TextField
                            label="Start Date"
                            type="date"
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setTimeFilter('custom');
                            }}
                            sx={{ width: { xs: '100%', sm: 'auto' }, bgcolor: 'background.paper', borderRadius: 1 }}
                        />
                        <TextField
                            label="End Date"
                            type="date"
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setTimeFilter('custom');
                            }}
                            sx={{ width: { xs: '100%', sm: 'auto' }, bgcolor: 'background.paper', borderRadius: 1 }}
                        />
                    </Box>

                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                        <Tabs
                            value={timeFilter}
                            onChange={(e, v) => {
                                setTimeFilter(v);
                                setStartDate('');
                                setEndDate('');
                            }}
                            variant="scrollable"
                            scrollButtons="auto"
                        >
                            <Tab label="All Orders" value="all" />
                            <Tab label="3+ Days Old" value="3_days_old" />
                            <Tab label="30+ Days Old" value="30_days_old" />
                        </Tabs>
                    </Box>

                    {filteredOrders.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4 }}>
                            <Alert severity="info" sx={{ justifyContent: 'center' }}>
                                {orders.length === 0 ? "No orders assigned to you yet." : `No orders match the current filters.`}
                            </Alert>
                        </Paper>
                    ) : (
                        <Grid container spacing={2}>
                            {filteredOrders.map((order) => {
                                const now = new Date();
                                const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : null;
                                let diffDays = 0;
                                if (orderDate) {
                                    const diffTime = Math.abs(now - orderDate);
                                    diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                }

                                const isOverdue30 = diffDays >= 30 && order.status !== 'completed';
                                const isOverdue3 = diffDays >= 3 && diffDays < 30 && order.status !== 'completed';
                                const isOverdue = isOverdue3 || isOverdue30;
                                const overdueText = isOverdue30 ? '30+ Days' : '3+ Days';

                                return (
                                    <Grid item xl={6} sm={6} md={6} lg={3} key={order.id}>
                                        <Paper
                                            sx={{
                                                p: { xs: 1.5, sm: 2 },
                                                borderRadius: 3,
                                                boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                                                height: '100%',
                                                minHeight: 320,
                                                width: { xs: '100%', sm: '220px', md: '240px' },
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between', // Distribute space
                                                transition: 'transform 0.2s',
                                                bgcolor: getEditorStatus(order) === 'completed' ? '#e8f5e9' : (isOverdue ? (isOverdue30 ? '#ffebee' : '#fff8e1') : 'background.paper'),
                                                border: getEditorStatus(order) === 'completed' ? '2px solid #4caf50' : (isOverdue ? `2px solid ${isOverdue30 ? '#d32f2f' : '#ed6c02'}` : 'none'),
                                                '&:hover': {
                                                    transform: 'translateY(-4px)',
                                                },
                                            }}
                                        >
                                            {isOverdue && (
                                                <Box sx={{ mb: 2, p: 1, borderRadius: 1, bgcolor: isOverdue30 ? 'error.lighter' : 'warning.lighter' }}>
                                                    <Box display="flex" alignItems="center" mb={1}>
                                                        <WarningIcon color={isOverdue30 ? 'error' : 'warning'} sx={{ mr: 1 }} />
                                                        <Typography variant="subtitle2" color={isOverdue30 ? 'error.main' : 'warning.main'} sx={{ textTransform: 'capitalize' }}>
                                                            This order is {order.status} for over {overdueText}!
                                                        </Typography>
                                                    </Box>
                                                    {/* <Box display="flex" gap={1}>
                                                <TextField
                                                    label="Message to Team Leader"
                                                    variant="outlined"
                                                    size="small"
                                                    fullWidth
                                                    value={messages[order.id] || ''}
                                                    onChange={(e) => setMessages(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                />
                                                <Button
                                                    variant="contained"
                                                    color={isOverdue30 ? 'error' : 'warning'}
                                                    onClick={() => handleSendNotificationToTL(order, overdueText)}
                                                    disabled={sending[order.id]}
                                                    size="small"
                                                    sx={{ whiteSpace: 'nowrap' }}
                                                >
                                                    {sending[order.id] ? <CircularProgress size={20} /> : 'Send Alert'}
                                                </Button>
                                            </Box> */}
                                                </Box>
                                            )}

                                            {order.hasPendingEdit && (
                                                <Alert severity="info" sx={{ mb: 1, py: 0, fontSize: '0.75rem' }}>
                                                    Edit pending approval
                                                </Alert>
                                            )}

                                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                                                {isBroadcast(order) ? (
                                                    <Chip
                                                        label="New Order Available"
                                                        color="primary"
                                                        size="small"
                                                        sx={{ fontWeight: 'bold' }}
                                                    />
                                                ) : (
                                                    <Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Tooltip title={order.status === 'pending' && !order.isSelfOrder ? "Please accept the order first" : ""} arrow>
                                                                <Box>
                                                                    <FormControl size="small" sx={{ minWidth: 140 }}>
                                                                        <InputLabel id={`status-label-${order.id}`}>Status</InputLabel>
                                                                        <Select
                                                                            labelId={`status-label-${order.id}`}
                                                                            value={getEditorStatus(order)}
                                                                            label="Status"
                                                                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                                            sx={{ bgcolor: 'background.paper' }}
                                                                            disabled={getEditorStatus(order) === 'completed' || (order.status === 'pending' && !order.isSelfOrder)}
                                                                        >
                                                                            <MenuItem value="pending" disabled>Pending</MenuItem>
                                                                            <MenuItem value="in-progress">In-Progress</MenuItem>
                                                                            <MenuItem value="completed">Completed</MenuItem>
                                                                        </Select>
                                                                    </FormControl>
                                                                </Box>
                                                            </Tooltip>
                                                            {getEditorStatus(order) === 'completed' && (
                                                                <Tooltip title="Status is locked">
                                                                    <LockIcon color="action" fontSize="small" />
                                                                </Tooltip>
                                                            )}
                                                        </Box>
                                                        {getEditorStatus(order) === 'completed' && order.status !== 'completed' && (
                                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                                                                Waiting for others
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                )}
                                                <Box display="flex" gap={0.5}>
                                                    {order.priority && order.priority !== 'normal' && (
                                                        <Chip
                                                            label={order.priority.toUpperCase()}
                                                            size="small"
                                                            color={getPriorityColor(order.priority)}
                                                            sx={{ fontSize: '0.7rem', height: 24, fontWeight: 'bold' }}
                                                        />
                                                    )}
                                                    {order.assignedEditorEmails?.length > 1 && !isBroadcast(order) && (
                                                        <Chip
                                                            label="SHARED"
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{
                                                                fontSize: '0.7rem',
                                                                height: 24,
                                                                color: '#9C27B0',
                                                                borderColor: '#9C27B0'
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            </Box>

                                            {/* Image Container with Fixed Height */}
                                            <Box
                                                sx={{
                                                    width: { xs: '100%', sm: 180, md: 210 },
                                                    height: { xs: 100, sm: 120 },
                                                    mb: 1,
                                                    borderRadius: 2,
                                                    overflow: 'hidden',
                                                    bgcolor: '#f5f5f5',
                                                    flexShrink: 0,
                                                    position: 'relative',
                                                    '&:hover': {
                                                        overflow: 'visible',
                                                        zIndex: 10,
                                                    },
                                                    '&:hover img': {
                                                        width: '70%',
                                                        height: '100%',
                                                        objectFit: 'contain', // Show full image on hover
                                                        transform: 'scale(2.3)',
                                                        boxShadow: 6,
                                                        borderRadius: 1,
                                                        bgcolor: 'background.paper'
                                                    }
                                                }}
                                            >
                                                <Box
                                                    component="img"
                                                    src={order.sampleImageUrl || 'No Image Available'}
                                                    alt="Order Sample"
                                                    sx={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover', // Fix overflow/cropping
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                />
                                            </Box>

                                            {/* Content Area */}
                                            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                                                <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{
                                                    fontSize: { xs: '0.9rem', sm: '1rem' },
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 1,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {order.name}
                                                </Typography>

                                                <Typography variant="caption" color="text.secondary" mb={0.5} display="block" sx={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    <strong>Telecaller:</strong> {order.telecaller}
                                                </Typography>

                                                <Typography variant="caption" color="text.secondary" mb={1} display="block">
                                                    Date: {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                                </Typography>

                                                {/* Remark Section */}
                                                <Box sx={{ mb: 1.5, overflow: 'hidden', width: '100%' }}>
                                                    {order.remark && (
                                                        <Typography variant="caption" sx={{
                                                            fontStyle: 'italic',
                                                            color: 'text.secondary',
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            bgcolor: '#fff8e1',
                                                            p: 0.5,
                                                            borderRadius: 1,
                                                        }}>
                                                            Remark: {order.remark}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>

                                            {order.status === 'pending' && !order.isSelfOrder && !order.hasPendingEdit ? (
                                                <Button
                                                    variant="contained"
                                                    fullWidth
                                                    color="success"
                                                    startIcon={<CheckCircleIcon />}
                                                    onClick={() => handleAcceptOrder(order)}
                                                    sx={{
                                                        mt: 'auto',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        boxShadow: '0 4px 14px 0 rgba(76, 175, 80, 0.39)'
                                                    }}
                                                >
                                                    Accept Order
                                                </Button>
                                            ) : (
                                                <Box display="flex" gap={1} mt="auto">
                                                    <Button
                                                        variant="contained"
                                                        fullWidth
                                                        onClick={() => handleOpenDetails(order)}
                                                        sx={{
                                                            background: 'linear-gradient(135deg,#667eea,#764ba2)',
                                                            fontSize: '0.75rem',
                                                            textTransform: 'none',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        Details
                                                    </Button>
                                                    <Button
                                                        variant="outlined"
                                                        onClick={() => handleEditClick(order)}
                                                        disabled={order.hasPendingEdit}
                                                        sx={{
                                                            minWidth: '40px',
                                                            px: 1
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </Button>
                                                </Box>
                                            )}
                                        </Paper>
                                    </Grid>)
                            })}
                        </Grid>
                    )}
                </>
            )}

            {/* Confirmation Dialog */}
            <Dialog open={confirmOpen} onClose={handleClose}>
                <DialogTitle>
                    {confirmStep === 1 ? "Mark Order as Completed?" : "Final Confirmation"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {confirmStep === 1
                            ? "Are you sure you want to mark this order as completed? This indicates the work is finished."
                            : "Please confirm again. Are you absolutely sure the order is complete and ready for delivery?"}
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ pb: { xs: 2, sm: 1 } }}>
                    <Button onClick={handleClose} color="inherit">Cancel</Button>
                    <Button onClick={handleConfirm} color={confirmStep === 1 ? "primary" : "success"} variant="contained">
                        {confirmStep === 1 ? "Proceed" : "Yes, Complete Order"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* View Details Modal */}
            <Dialog
                open={detailsOpen}
                onClose={handleCloseDetails}
                fullScreen={isMobile}
                maxWidth="md"
                fullWidth
                scroll="paper"
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                    Order Details
                    <IconButton onClick={handleCloseDetails}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedOrder && (
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Box
                                    component="img"
                                    src={selectedOrder.sampleImageUrl || 'No Image Available'}
                                    alt={selectedOrder.name}
                                    sx={{
                                        width: '100%',
                                        borderRadius: 2,
                                        maxHeight: 400,
                                        objectFit: 'contain',
                                        bgcolor: '#f5f5f5'
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <Typography variant="h5" fontWeight={700} gutterBottom>
                                    {selectedOrder.name}
                                </Typography>

                                <Box sx={{ mb: 2 }}>
                                    <Chip
                                        label={selectedOrder.status.toUpperCase()}
                                        color={selectedOrder.status === 'completed' ? 'success' : 'warning'}
                                        size="small"
                                        sx={{ fontWeight: 'bold', mr: 1 }}
                                    />
                                    {selectedOrder.priority && selectedOrder.priority !== 'normal' && (
                                        <Chip
                                            label={selectedOrder.priority.toUpperCase()}
                                            color={getPriorityColor(selectedOrder.priority)}
                                            size="small"
                                            sx={{ fontWeight: 'bold', mr: 1 }}
                                        />
                                    )}
                                    {selectedOrder.assignedEditorEmails?.length > 1 && (
                                        <Chip label="SHARED" size="small" variant="outlined" sx={{ color: '#9C27B0', borderColor: '#9C27B0' }} />
                                    )}
                                </Box>

                                <Box>
                                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                                        Telecaller
                                    </Typography>
                                    <Typography variant="body1">
                                        {selectedOrder.telecaller}
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                                        Created Date
                                    </Typography>
                                    <Typography variant="body1">
                                        {selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleString() : 'N/A'}
                                    </Typography>
                                </Box>

                                {selectedOrder.completedAt && (
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                                            Completed Date
                                        </Typography>
                                        {/* <Typography variant="body1">
                                            {selectedOrder.completedAt.toDate().toLocaleString()}
                                        </Typography> */}
                                        <Typography variant="body1">
                                            {selectedOrder.completedAt
                                                ? selectedOrder.completedAt.toDate().toLocaleDateString('en-GB', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })
                                                : '-'}
                                        </Typography>
                                    </Box>
                                )}

                                <Box>
                                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                                        Assigned Editors
                                    </Typography>
                                    <Typography variant="body1">
                                        {selectedOrder.assignedEditorNames?.join(', ') || 'N/A'}
                                    </Typography>
                                </Box>

                                {selectedOrder.remark && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fff8e1', borderRadius: 2, border: '1px dashed #ffe0b2' }}>
                                        <Typography variant="subtitle2" fontWeight={800} color="warning.dark" gutterBottom>
                                            REMARKS
                                        </Typography>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                            {selectedOrder.remark}
                                        </Typography>
                                    </Box>
                                )}
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions sx={{ pb: { xs: 2, sm: 1 } }}>
                    <Button onClick={handleCloseDetails} color="primary">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            <EditorEditOrderDialog
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                order={editingOrder}
                onSave={handleEditSave}
            />
        </Container>
    );
};

export default EditorDashboard;