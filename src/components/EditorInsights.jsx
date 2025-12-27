// src/components/EditorInsights.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Avatar,
    Chip,
    LinearProgress,
    Paper,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    IconButton,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import {
    Person as PersonIcon,
    Assignment as AssignmentIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
    TrendingUp as TrendingUpIcon,
    Work as WorkIcon,
    Timeline as TimelineIcon,
    Refresh as RefreshIcon,
    Group as GroupIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useEditorStats } from '../context/EditorStatsContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useOrders } from '../hooks/useOrders';

const EditorInsights = () => {
    const { user } = useAuth();
    const { editorStats, loading, refreshStats } = useEditorStats();
    const { orders: allOrders, loading: ordersLoading } = useOrders();
    const [selectedEditorEmail, setSelectedEditorEmail] = useState(null);

    const enrichedEditorStats = useMemo(() => {
        if (!editorStats || !allOrders) return [];
        return editorStats.map(editor => {
            const ordersForEditor = allOrders.filter(o => o.assignedEditorEmails?.includes(editor.email));
            return {
                ...editor,
                liveTotalAssigned: ordersForEditor.length,
                liveTotalCompleted: ordersForEditor.filter(o => o.status === 'completed').length
            };
        }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [editorStats, allOrders]);

    useEffect(() => {
        if (enrichedEditorStats.length > 0 && !selectedEditorEmail) {
            setSelectedEditorEmail(enrichedEditorStats[0].email);
        }
    }, [enrichedEditorStats, selectedEditorEmail]);

    const selectedEditor = useMemo(() => {
        return enrichedEditorStats.find(e => e.email === selectedEditorEmail) || null;
    }, [enrichedEditorStats, selectedEditorEmail]);

    // Filter orders for selected editor
    const editorOrders = useMemo(() => {
        if (!selectedEditorEmail || !allOrders) return [];
        return allOrders.filter(order => order.assignedEditorEmails?.includes(selectedEditorEmail));
    }, [selectedEditorEmail, allOrders]);

    // Calculate metrics locally to include In-Progress and Shared stats
    const localMetrics = useMemo(() => {
        if (!editorOrders) return { workload: 0, sharedPending: 0, sharedInProgress: 0 };

        let workload = 0;
        let sharedPending = 0;
        let sharedInProgress = 0;

        editorOrders.forEach(order => {
            const isShared = order.assignedEditorEmails?.length > 1;

            if (order.status === 'pending' || order.status === 'in-progress') {
                workload++; // Include both pending and in-progress in workload
                if (isShared && order.status === 'pending') sharedPending++;
                if (isShared && order.status === 'in-progress') sharedInProgress++;
            }
        });

        return { workload, sharedPending, sharedInProgress };
    }, [editorOrders]);

    const recentActivity = useMemo(() => {
        if (!editorOrders || !selectedEditor) return [];

        return editorOrders
            .filter(order => order.status === 'completed' && order.completedAt)
            .sort((a, b) => {
                const tA = a.completedAt?.seconds || 0;
                const tB = b.completedAt?.seconds || 0;
                return tB - tA;
            })
            .slice(0, 5)
            .map(order => ({
                id: order.id,
                customerName: order.name,
                editorName: selectedEditor.name || selectedEditor.email?.split('@')[0] || 'Editor',
                timestamp: order.completedAt
            }));
    }, [editorOrders, selectedEditor]);

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp.seconds * 1000).toLocaleDateString();
    };

    const averageTurnaround = useMemo(() => {
        if (!editorOrders || editorOrders.length === 0) return 0;

        const completedOrders = editorOrders.filter(o => o.status === 'completed' && o.completedAt && o.createdAt);
        if (completedOrders.length === 0) return 0;

        const totalHours = completedOrders.reduce((sum, order) => {
            const start = order.createdAt.toDate();
            const end = order.completedAt.toDate();
            return sum + (end - start) / (1000 * 60 * 60);
        }, 0);

        return (totalHours / completedOrders.length).toFixed(1);
    }, [editorOrders]);

    const performanceData = useMemo(() => {
        if (!editorOrders) return [];

        const stats = {};

        editorOrders.forEach(order => {
            if (order.createdAt) {
                const date = order.createdAt.toDate();
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthName = date.toLocaleString('default', { month: 'short' });
                if (!stats[key]) stats[key] = { month: monthName, assigned: 0, completed: 0, totalTurnaround: 0, turnaroundCount: 0 };
                stats[key].assigned += 1;
            }
            if (order.status === 'completed' && order.completedAt && order.createdAt) {
                const date = order.completedAt.toDate();
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthName = date.toLocaleString('default', { month: 'short' });
                if (!stats[key]) stats[key] = { month: monthName, assigned: 0, completed: 0, totalTurnaround: 0, turnaroundCount: 0 };
                stats[key].completed += 1;
                const hours = (order.completedAt.toDate() - order.createdAt.toDate()) / (1000 * 60 * 60);
                stats[key].totalTurnaround += hours;
                stats[key].turnaroundCount += 1;
            }
        });

        return Object.keys(stats).sort().map(key => ({
            month: stats[key].month,
            assigned: stats[key].assigned,
            completed: stats[key].completed,
            avgTurnaround: stats[key].turnaroundCount > 0 ? parseFloat((stats[key].totalTurnaround / stats[key].turnaroundCount).toFixed(1)) : 0
        }));
    }, [editorOrders]);

    const getWorkloadColor = (workload) => {
        if (workload >= 80) return 'error';
        if (workload >= 60) return 'warning';
        return 'success';
    };

    if (loading) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Loading Editor Insights...
                </Typography>
                <LinearProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Editor Insights
                </Typography>
                <Tooltip title="Refresh Data">
                    <IconButton color="default">
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            <Grid container spacing={3}>
                {/* Editor List */}
                <Grid item xs={12} md={3}>
                    <Box
                        sx={{
                            position: { md: 'sticky' },
                            top: { md: 100 },
                        }}
                    >
                        <Typography
                            variant="h6"
                            gutterBottom
                            sx={{ display: 'flex', alignItems: 'center', mb: 2 }}
                        >
                            <PersonIcon sx={{ mr: 1 }} />
                            Editors ({editorStats.length})
                        </Typography>

                        {/* Horizontal Editor Row */}
                        <Box
                            sx={{
                                display: 'flex',
                                gap: 2,
                                flexWrap: 'wrap',
                                justifyContent: { xs: 'center', md: 'flex-start' },
                            }}
                        >
                            {enrichedEditorStats.map((editor) => {
                                const isSelected = selectedEditorEmail === editor.email;

                                return (
                                    <Box
                                        key={editor.email}
                                        onClick={() => setSelectedEditorEmail(editor.email)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1.5,
                                            cursor: 'pointer',
                                            p: { xs: 1, md: 2 },
                                            minWidth: { md: 240 },
                                            borderRadius: 2,
                                            border: '1px solid',
                                            borderColor: isSelected ? 'transparent' : 'divider',
                                            background: isSelected
                                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                                : 'background.paper',
                                            color: isSelected ? 'white' : 'text.primary',
                                            boxShadow: isSelected
                                                ? '0 4px 12px rgba(118,75,162,0.3)'
                                                : '0 1px 3px rgba(0,0,0,0.05)',
                                            transition: 'all 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                            },
                                        }}
                                    >
                                        {/* Avatar – ALWAYS visible */}
                                        <Avatar
                                            sx={{
                                                bgcolor: isSelected
                                                    ? 'rgba(255,255,255,0.25)'
                                                    : 'primary.light',
                                            }}
                                        >
                                            {editor.name?.charAt(0)?.toUpperCase() || 'E'}
                                        </Avatar>

                                        {/* Text – hidden on mobile */}
                                        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                                            <Typography fontWeight={600}>
                                                {editor.name || editor.email}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: isSelected
                                                        ? 'rgba(255,255,255,0.7)'
                                                        : 'text.secondary',
                                                }}
                                            >
                                                {editor.liveTotalAssigned || 0} Assigned /{' '}
                                                {editor.liveTotalCompleted || 0} Completed
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                </Grid>


                {/* Editor Details */}
                <Grid item xs={12} md={9}>
                    {selectedEditor ? (
                        <>
                            {/* Profile Header */}
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Avatar sx={{ width: 64, height: 64, mr: 2 }}>
                                            {selectedEditor.name?.charAt(0)?.toUpperCase() || 'E'}
                                        </Avatar>
                                        <Box>
                                            <Typography variant="h5">{selectedEditor.name || 'Unknown Editor'}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {selectedEditor.email}
                                            </Typography>
                                            {/* <Chip
                                                label={`Active since ${formatDate(selectedEditor.createdAt)}`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ mt: 1 }}
                                            /> */}
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>

                            {/* Summary Cards */}
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={12} sm={3}>
                                    <Card>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                            <AssignmentIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                                            <Typography variant="h4">{selectedEditor?.liveTotalAssigned || 0}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Total Assigned
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <Card>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                            <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                                            <Typography variant="h4">{selectedEditor?.liveTotalCompleted || 0}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Completed
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <Card>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                            <ScheduleIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
                                            <Typography variant="h4">{averageTurnaround}h</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Avg Turnaround
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <Card>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                            <WorkIcon color={getWorkloadColor(localMetrics.workload)} sx={{ fontSize: 40, mb: 1, color: '#F44336' }} />
                                            <Typography variant="h4">{localMetrics.workload}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Current Workload
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <Card>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                            <GroupIcon sx={{ fontSize: 40, mb: 1, color: '#9C27B0' }} />
                                            <Typography variant="h4">{localMetrics.sharedPending}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Shared Pending
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <Card>
                                        <CardContent sx={{ textAlign: 'center' }}>
                                            <GroupIcon sx={{ fontSize: 40, mb: 1, color: '#7B1FA2' }} />
                                            <Typography variant="h4">{localMetrics.sharedInProgress}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Shared In-Progress
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>

                            {/* Performance Chart */}
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                        Monthly Performance
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={performanceData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <RechartsTooltip />
                                            <Bar dataKey="completed" fill="#4caf50" name="Completed" />
                                            <Bar dataKey="assigned" fill="#2196f3" name="Assigned" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Turnaround Time Chart */}
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                        Turnaround Time Trend
                                    </Typography>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <LineChart data={performanceData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" />
                                            <YAxis />
                                            <RechartsTooltip />
                                            <Line type="monotone" dataKey="avgTurnaround" stroke="#ff9800" strokeWidth={2} name="Avg Hours" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Recent Activity */}
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Recent Activity
                                    </Typography>
                                    <List>
                                        {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
                                            <React.Fragment key={activity.id}>
                                                <ListItem>
                                                    <ListItemText
                                                        primary={`Completed order for ${activity.customerName}`}
                                                        secondary={`Updated by ${activity.editorName} • ${formatDate(activity.timestamp)}`}
                                                    />
                                                </ListItem>
                                                {index < recentActivity.length - 1 && <Divider />}
                                            </React.Fragment>
                                        )) : (
                                            <ListItem>
                                                <ListItemText primary="No recent activity" />
                                            </ListItem>
                                        )}
                                    </List>
                                </CardContent>
                            </Card>

                            {/* Editor's Orders */}
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                                        Editor's Orders ({editorOrders.length})
                                    </Typography>
                                    {ordersLoading ? (
                                        <LinearProgress />
                                    ) : editorOrders.length > 0 ? (
                                        <TableContainer component={Paper} sx={{ mt: 2 }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell>Telecaller</TableCell>
                                                        <TableCell>Status</TableCell>
                                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Created</TableCell>
                                                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Completed</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {editorOrders.map((order) => (
                                                        <TableRow key={order.id}>
                                                            <TableCell>{order.telecaller}</TableCell>
                                                            <TableCell>
                                                                <Chip
                                                                    label={order.status}
                                                                    color={order.status === 'completed' ? 'success' : order.status === 'in-progress' ? 'info' : 'warning'}
                                                                    size="small"
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{order.createdAt?.toDate().toLocaleDateString()}</TableCell>
                                                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{order.completedAt?.toDate().toLocaleDateString() || 'N/A'}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                            No orders assigned to this editor.
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <Paper sx={{ p: 4, textAlign: 'center' }}>
                            <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                                Select an editor to view insights
                            </Typography>
                        </Paper>
                    )}
                </Grid>
            </Grid>
        </Box>
    );
};

export default EditorInsights;