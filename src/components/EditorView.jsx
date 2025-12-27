// src/components/EditorView.jsx
import React, { useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
    Box,
    Card,
    CardContent,
    Chip,
    Grid,
    Typography,
    Button,
    CircularProgress,
    Alert,
    Tabs,
    Tab,
    TextField,
    InputAdornment,
    TablePagination,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import {
    Pending as PendingIcon,
    CheckCircle as CompletedIcon,
    Download as DownloadIcon,
    Visibility as VisibilityIcon,
    Lock as LockIcon,
    Search as SearchIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';

// Removed date-fns import, replaced with a local function
const formatDistanceToNow = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) {
        const years = Math.floor(interval);
        return `${years} year${years > 1 ? 's' : ''} ago`;
    }
    interval = seconds / 2592000;
    if (interval > 1) {
        const months = Math.floor(interval);
        return `${months} month${months > 1 ? 's' : ''} ago`;
    }
    interval = seconds / 86400;
    if (interval > 1) {
        const days = Math.floor(interval);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    interval = seconds / 3600;
    if (interval > 1) {
        const hours = Math.floor(interval);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    interval = seconds / 60;
    if (interval > 1) {
        const minutes = Math.floor(interval);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    return `${Math.floor(seconds)} second${seconds !== 1 ? 's' : ''} ago`;
};


const statusStyles = {
    pending: {
        chip: {
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            color: '#E65100',
            border: '1px solid #E65100',
        },
        button: {
            backgroundColor: 'rgba(255, 165, 0, 0.1)',
            color: '#E65100',
            '&:hover': {
                backgroundColor: 'rgba(255, 165, 0, 0.2)',
            },
        },
    },
    'in-progress': {
        chip: {
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            color: '#0D47A1',
            border: '1px solid #0D47A1',
        },
        button: {
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            color: '#0D47A1',
            '&:hover': {
                backgroundColor: 'rgba(25, 118, 210, 0.2)',
            },
        },
    },
    completed: {
        chip: {
            backgroundColor: 'rgba(46, 125, 50, 0.1)',
            color: '#1B5E20',
            border: '1px solid #1B5E20',
        },
        button: {
            backgroundColor: 'rgba(46, 125, 50, 0.1)',
            color: '#1B5E20',
            '&:hover': {
                backgroundColor: 'rgba(46, 125, 50, 0.2)',
            },
        },
    },
};

const StatCard = ({ title, value, icon, color }) => (
    <Card
        sx={{
            background: `linear-gradient(135deg, ${color} 0%, ${color} 60%, #ffffff 100%)`,
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 20px 0 rgba(0,0,0,0.12)',
            transition: 'transform 0.3s',
            '&:hover': {
                transform: 'translateY(-5px)',
            },
        }}
    >
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
            <Box>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{title}</Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>{value}</Typography>
            </Box>
            <Box sx={{ fontSize: '4rem', opacity: 0.8 }}>{icon}</Box>
        </CardContent>
    </Card>
);

const EditorView = () => {
    const { orders, loading } = useOrders();
    const [timeFilter, setTimeFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sortBy, setSortBy] = useState('dateDesc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(9);

    const sortedOrders = [...orders].sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;

        if (sortBy === 'dateAsc') {
            return dateA - dateB;
        } else if (sortBy === 'status') {
            const statusOrder = { 'pending': 1, 'in-progress': 2, 'completed': 3 };
            return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        }
        // Default dateDesc
        return dateB - dateA;
    });

    const filteredOrders = sortedOrders.filter(order => {
        // Search Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const nameMatch = order.name?.toLowerCase().includes(query);
            const telecallerMatch = order.telecaller?.toLowerCase().includes(query);
            if (!nameMatch && !telecallerMatch) return false;
        }

        if (!order.createdAt) return false;
        const orderDate = order.createdAt.toDate();

        // Custom Date Range
        if (startDate || endDate) {
            if (startDate && orderDate < new Date(startDate + "T00:00:00")) return false;
            if (endDate && orderDate > new Date(endDate + "T23:59:59")) return false;
            return true;
        }

        // Tab Filter
        if (timeFilter === 'all') return true;
        if (typeof timeFilter === 'number') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - timeFilter);
            return orderDate >= cutoff;
        }
        return true;
    });

    const paginatedOrders = filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleStatusChange = async (orderId, currentStatus, newStatus) => {
        if (currentStatus === newStatus) return;

        const confirmMessage = `Are you sure you want to change the status to "${newStatus}"?`;
        if (!window.confirm(confirmMessage)) return;

        if (newStatus === 'completed') {
            const secondConfirm = window.confirm('This action will mark the order as completed. Are you sure?');
            if (!secondConfirm) return;
        }

        try {
            const updateData = { status: newStatus };
            if (newStatus === 'completed') {
                updateData.completedAt = serverTimestamp();
            } else {
                updateData.completedAt = null;
            }
            await updateDoc(doc(db, 'orders', orderId), updateData);
            toast.success(`Status updated to "${newStatus}"`);
        } catch (error) {
            toast.error('Error updating status: ' + error.message);
        }
    };

    const handleDownload = (url) => {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'sample-image'); // Or derive a better name
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const completedToday = orders.filter(o => {
        if (o.status !== 'completed' || !o.completedAt) return false;
        const completedDate = o.completedAt.toDate();
        const today = new Date();
        return completedDate.toDateString() === today.toDateString();
    }).length;

    return (
        <Box sx={{ p: { xs: 2, sm: 3 }, background: 'linear-gradient(to right bottom, #f0f4f8, #ffffff)' }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4, color: '#1A237E' }}>
                My Assigned Orders
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6}>
                    <StatCard title="Pending Orders" value={pendingCount} icon={<PendingIcon />} color="#FFB74D" />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <StatCard title="Completed Today" value={completedToday} icon={<CompletedIcon />} color="#81C784" />
                </Grid>
            </Grid>

            <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                    label="Search by Client or Telecaller"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(0);
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ flexGrow: 1, minWidth: '250px', bgcolor: 'white', borderRadius: 1 }}
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
                        setPage(0);
                    }}
                    sx={{ bgcolor: 'white', borderRadius: 1 }}
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
                        setPage(0);
                    }}
                    sx={{ bgcolor: 'white', borderRadius: 1 }}
                />
                <FormControl size="small" sx={{ minWidth: 150, bgcolor: 'white', borderRadius: 1 }}>
                    <InputLabel>Sort By</InputLabel>
                    <Select
                        value={sortBy}
                        label="Sort By"
                        onChange={(e) => {
                            setSortBy(e.target.value);
                            setPage(0);
                        }}
                    >
                        <MenuItem value="dateDesc">Newest First</MenuItem>
                        <MenuItem value="dateAsc">Oldest First</MenuItem>
                        <MenuItem value="status">Status</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs
                    value={timeFilter}
                    onChange={(e, v) => {
                        setTimeFilter(v);
                        setStartDate('');
                        setEndDate('');
                        setPage(0);
                    }}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab label="All Orders" value="all" />
                    <Tab label="Last 3 Days" value={3} />
                    <Tab label="Last 7 Days" value={7} />
                    <Tab label="Last 30 Days" value={30} />
                </Tabs>
            </Box>

            {filteredOrders.length === 0 ? (
                <Alert severity="info" sx={{ mt: 4 }}>
                    {orders.length === 0 ? "You have no assigned orders." : "No orders found for the selected time range."}
                </Alert>
            ) : (
                <Grid container spacing={3} sx={{ mb: 4 }}>
                    {paginatedOrders.map((order) => (
                        <Grid item xs={12} md={6} lg={4} key={order.id}>
                            <Card
                                sx={{
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 12px 0 rgba(0,0,0,0.08)',
                                    transition: 'transform 0.3s, box-shadow 0.3s',
                                    '&:hover': {
                                        transform: 'translateY(-5px)',
                                        boxShadow: '0 8px 24px 0 rgba(0,0,0,0.12)',
                                    },
                                    borderTop: `4px solid ${statusStyles[order.status]?.chip.color || '#ccc'}`,
                                }}
                            >
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            By: {order.telecaller}
                                        </Typography>
                                        <Chip
                                            label={order.status}
                                            size="small"
                                            sx={{ ...statusStyles[order.status]?.chip, textTransform: 'capitalize' }}
                                        />
                                    </Box>

                                    {order.sampleImageUrl && (
                                        <Box sx={{ my: 2, textAlign: 'center' }}>
                                            <img
                                                src={order.sampleImageUrl}
                                                alt="sample"
                                                style={{
                                                    width: '100%',
                                                    maxHeight: '200px',
                                                    objectFit: 'contain',
                                                    borderRadius: '8px',
                                                    background: '#f5f5f5'
                                                }}
                                            />
                                            <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'center' }}>
                                                <Button startIcon={<VisibilityIcon />} size="small" onClick={() => window.open(order.sampleImageUrl, '_blank')}>View</Button>
                                                <Button startIcon={<DownloadIcon />} size="small" onClick={() => handleDownload(order.sampleImageUrl)}>Download</Button>
                                            </Box>
                                        </Box>
                                    )}

                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        {formatDistanceToNow(order.createdAt.toDate())}
                                    </Typography>

                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                                        {['pending', 'in-progress', 'completed'].map(status => (
                                            <Button
                                                key={status}
                                                variant={order.status === status ? 'contained' : 'text'}
                                                onClick={() => handleStatusChange(order.id, order.status, status)}
                                                disabled={order.status === 'completed'}
                                                startIcon={order.status === 'completed' && status === 'completed' ? <LockIcon /> : null}
                                                sx={{
                                                    flex: 1,
                                                    minWidth: '100px',
                                                    textTransform: 'capitalize',
                                                    ...(order.status === status
                                                        ? { ...statusStyles[status]?.button, fontWeight: 'bold' }
                                                        : { color: 'text.secondary' }
                                                    )
                                                }}
                                            >
                                                {status.replace('-', ' ')}
                                            </Button>
                                        ))}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <TablePagination
                rowsPerPageOptions={[9, 18, 27, 45]}
                component="div"
                count={filteredOrders.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />
        </Box>
    );
};

export default EditorView;