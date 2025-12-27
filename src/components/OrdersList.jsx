// src/components/OrdersList.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, deleteDoc, collection, query, onSnapshot, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useOrders } from '../hooks/useOrders';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Typography,
    Box,
    Grid,
    Avatar,
    TextField,
    InputAdornment,
    Pagination,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    DialogContentText,
    Tooltip,
    Popover,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import { toast } from 'react-toastify';

const statusColors = {
    pending: 'warning',
    'in-progress': 'info',
    completed: 'success',
};

const OrdersList = ({ highlightOrderId, onClearHighlight }) => {
    const { orders, loading } = useOrders();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [editors, setEditors] = useState([]);
    const ordersPerPage = 10;

    // Edit State
    const [editOpen, setEditOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [editForm, setEditForm] = useState({
        name: '',
        telecaller: '',
        status: '',
        assignedEditorEmails: [],
        assignedEditorNames: [],
        sampleImageUrl: ''
    });
    const [editFile, setEditFile] = useState(null);

    // Confirmation State
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmStep, setConfirmStep] = useState(0);
    const [saving, setSaving] = useState(false);

    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteStep, setDeleteStep] = useState(0);
    const [orderToDelete, setOrderToDelete] = useState(null);

    // Popover State
    const [anchorEl, setAnchorEl] = useState(null);
    const [popoverOrder, setPopoverOrder] = useState(null);

    // Details Modal State
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        const q = query(collection(db, 'users'), where('role', '==', 'editor'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedEditors = snapshot.docs.map(doc => ({
                email: doc.data().email,
                name: doc.data().displayName || doc.data().email
            }));
            setEditors(fetchedEditors);
        }, (error) => {
            console.error("Error fetching editors:", error);
            toast.error("Failed to fetch editors list.");
        });
        return () => unsubscribe();
    }, []);

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

    const handlePopoverOpen = (event, order) => {
        setAnchorEl(event.currentTarget);
        setPopoverOrder(order);
    };

    const handlePopoverClose = () => {
        setAnchorEl(null);
        setPopoverOrder(null);
    };

    const handleNameClick = (e, order) => {
        e.stopPropagation();
        setSelectedOrder(order);
        setDetailsOpen(true);
        handlePopoverClose();
    };

    const handleDetailsClose = () => {
        setDetailsOpen(false);
        setSelectedOrder(null);
    };

    const handleEditClick = (e, order) => {
        e.stopPropagation();
        setEditingOrder(order);
        setEditForm({
            name: order.name,
            telecaller: order.telecaller,
            status: order.status,
            assignedEditorEmails: order.assignedEditorEmails || [],
            assignedEditorNames: order.assignedEditorNames || [],
            sampleImageUrl: order.sampleImageUrl || ''
        });
        setEditFile(null);
        setEditOpen(true);
    };

    const handleEditClose = () => {
        setEditOpen(false);
        setEditingOrder(null);
        setConfirmStep(0);
    };

    const handleEditChange = (e) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const handleEditorChange = (e) => {
        const value = e.target.value;
        if (value === 'all') {
            setEditForm({
                ...editForm,
                assignedEditorEmails: editors.map(ed => ed.email),
                assignedEditorNames: editors.map(ed => ed.name),
            });
        } else {
            const ed = editors.find(i => i.email === value);
            setEditForm({
                ...editForm,
                assignedEditorEmails: [ed.email],
                assignedEditorNames: [ed.name],
            });
        }
    };

    const handleSaveClick = () => {
        setConfirmStep(1);
        setConfirmOpen(true);
    };

    const handleConfirmAction = async () => {
        if (confirmStep === 1) {
            setConfirmStep(2);
        } else {
            setSaving(true);
            try {
                let imageUrl = editForm.sampleImageUrl;
                if (editFile) {
                    const storageRef = ref(storage, `samples/${Date.now()}_${editFile.name}`);
                    await uploadBytes(storageRef, editFile);
                    imageUrl = await getDownloadURL(storageRef);
                }

                const orderRef = doc(db, 'orders', editingOrder.id);
                await updateDoc(orderRef, {
                    name: editForm.name,
                    telecaller: editForm.telecaller,
                    status: editForm.status,
                    assignedEditorEmails: editForm.assignedEditorEmails,
                    assignedEditorNames: editForm.assignedEditorNames,
                    sampleImageUrl: imageUrl
                });

                toast.success('Order updated successfully');
                setConfirmOpen(false);
                handleEditClose();
            } catch (error) {
                console.error(error);
                toast.error('Failed to update order');
            } finally {
                setSaving(false);
            }
        }
    };

    const handleDeleteClick = (e, order) => {
        e.stopPropagation();
        setOrderToDelete(order);
        setDeleteStep(1);
        setDeleteOpen(true);
        // If triggered from edit modal, close it
        if (editOpen) handleEditClose();
    };

    const handleDeleteConfirm = async () => {
        if (deleteStep === 1) {
            setDeleteStep(2);
            return;
        }

        try {
            await deleteDoc(doc(db, 'orders', orderToDelete.id));
            toast.success('Order deleted successfully');
            setDeleteOpen(false);
            setOrderToDelete(null);
            setDeleteStep(0);
        } catch (error) {
            console.error("Error deleting order:", error);
            toast.error('Failed to delete order');
        }
    };

    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) {
            return Math.floor(interval) + " years ago";
        }
        interval = seconds / 2592000;
        if (interval > 1) {
            return Math.floor(interval) + " months ago";
        }
        interval = seconds / 86400;
        if (interval > 1) {
            return Math.floor(interval) + " days ago";
        }
        interval = seconds / 3600;
        if (interval > 1) {
            return Math.floor(interval) + " hours ago";
        }
        interval = seconds / 60;
        if (interval > 1) {
            return Math.floor(interval) + " minutes ago";
        }
        return Math.floor(seconds) + " seconds ago";
    };

    const filteredOrders = useMemo(() => {
        if (!searchTerm) {
            return orders;
        }
        return orders.filter(order =>
            order.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.telecaller.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.assignedEditorNames && order.assignedEditorNames.some(n => n.toLowerCase().includes(searchTerm.toLowerCase())))
        );
    }, [orders, searchTerm]);

    // Reset to page 1 when search term changes for better UX
    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    const pageCount = Math.ceil(filteredOrders.length / ordersPerPage);
    const paginatedOrders = useMemo(() => {
        return filteredOrders.slice((page - 1) * ordersPerPage, page * ordersPerPage);
    }, [filteredOrders, page, ordersPerPage]);


    if (loading) return <div>Loading...</div>;

    const renderAvatar = (order) => {
        if (order.sampleImageUrl) {
            return (
                <Tooltip
                    title={
                        <Box
                            component="img"
                            src={order.sampleImageUrl}
                            sx={{ width: 200, height: 'auto', borderRadius: 1 }}
                        />
                    }
                    arrow
                >
                    <Avatar src={order.sampleImageUrl} alt={order.name} sx={{ width: 40, height: 40 }} />
                </Tooltip>
            );
        }
        return (
            <Avatar sx={{ bgcolor: 'primary.light', width: 40, height: 40 }}>{order.name.charAt(0)}</Avatar>
        );
    };

    const renderStatusChip = (order) => {
        const isShared = order.assignedEditorEmails?.length > 1;
        const completedCount = order.completedBy?.length || 0;
        const totalEditors = order.assignedEditorEmails?.length || 0;

        let label = order.status;
        if (isShared && order.status === 'in-progress') {
            label = `In-Progress (${completedCount}/${totalEditors})`;
        }

        return (
            <Tooltip title={isShared ? `Completed by ${completedCount}/${totalEditors} editors` : ''} arrow>
                <Chip label={label} color={statusColors[order.status] || 'default'} size="small" sx={{ textTransform: 'capitalize', cursor: isShared ? 'help' : 'default' }} />
            </Tooltip>
        );
    };

    const renderOrders = () => (
        paginatedOrders.map((order) => (
            <TableRow
                key={order.id}
                sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    '&:hover': { backgroundColor: 'action.hover' }
                }}
            >
                <TableCell component="th" scope="row">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {renderAvatar(order)}
                        <Typography
                            variant="body1"
                            fontWeight="500"
                            onClick={(e) => handleNameClick(e, order)}
                            onMouseEnter={(e) => handlePopoverOpen(e, order)}
                            onMouseLeave={handlePopoverClose}
                            sx={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '4px', color: 'primary.main' }}
                        >
                            {order.name}
                        </Typography>
                    </Box>
                </TableCell>
                <TableCell>{order.telecaller}</TableCell>
                <TableCell>{order.assignedEditorNames?.join(', ')}</TableCell>
                <TableCell>
                    {renderStatusChip(order)}
                </TableCell>
                <TableCell>{order.createdAt ? timeAgo(order.createdAt.toDate()) : 'N/A'}</TableCell>
                <TableCell>
                    <IconButton onClick={(e) => handleEditClick(e, order)} size="small" color="primary">
                        <EditIcon />
                    </IconButton>
                    <IconButton onClick={(e) => handleDeleteClick(e, order)} size="small" color="error">
                        <DeleteIcon />
                    </IconButton>
                </TableCell>
            </TableRow>
        ))
    );

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search orders by name, number, country..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                />
            </Box>
            <Paper sx={{ borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <TableContainer>
                    <Table sx={{ minWidth: 650 }} aria-label="orders table">
                        <TableHead sx={{ '& .MuiTableCell-root': { fontWeight: '600', backgroundColor: 'action.hover' } }}>
                            <TableRow>
                                <TableCell>Customer Name</TableCell>
                                <TableCell>Telecaller</TableCell>
                                <TableCell>Assigned To</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Age</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {renderOrders()}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
            {pageCount > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Pagination
                        count={pageCount}
                        page={page}
                        onChange={(event, value) => setPage(value)}
                        color="primary"
                    />
                </Box>
            )}

            {/* Edit Dialog */}
            <Dialog open={editOpen} onClose={handleEditClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Edit Order
                    <IconButton
                        onClick={(e) => handleDeleteClick(e, editingOrder)}
                        color="error"
                        title="Delete Order"
                    >
                        <DeleteIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Name"
                            name="name"
                            value={editForm.name}
                            onChange={handleEditChange}
                            fullWidth
                        />
                        <TextField
                            label="Telecaller"
                            name="telecaller"
                            value={editForm.telecaller}
                            onChange={handleEditChange}
                            fullWidth
                        />
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select
                                name="status"
                                value={editForm.status}
                                label="Status"
                                onChange={handleEditChange}
                            >
                                <MenuItem value="pending">Pending</MenuItem>
                                <MenuItem value="in-progress">In-Progress</MenuItem>
                                <MenuItem value="completed">Completed</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Reassign Editor</InputLabel>
                            <Select
                                value={
                                    editForm.assignedEditorEmails.length === editors.length
                                        ? 'all'
                                        : editForm.assignedEditorEmails[0] || ''
                                }
                                label="Reassign Editor"
                                onChange={handleEditorChange}
                            >
                                <MenuItem value="all">All Editors</MenuItem>
                                {editors.map((e) => (
                                    <MenuItem key={e.email} value={e.email}>
                                        {e.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Box>
                            <Typography variant="subtitle2" gutterBottom>Update Image</Typography>
                            <Button
                                component="label"
                                variant="outlined"
                                startIcon={<CloudUploadIcon />}
                                fullWidth
                            >
                                Upload New Image
                                <input
                                    type="file"
                                    hidden
                                    onChange={(e) => setEditFile(e.target.files[0])}
                                />
                            </Button>
                            {editFile && <Typography variant="caption">{editFile.name}</Typography>}
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleEditClose}>Cancel</Button>
                    <Button onClick={handleSaveClick} variant="contained">Save Changes</Button>
                </DialogActions>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <DialogTitle>{confirmStep === 1 ? "Confirm Update" : "Final Warning"}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {confirmStep === 1
                            ? "Are you sure you want to update this order?"
                            : "This will change the order details for editors and cannot be undone easily. Proceed?"}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmAction} color="warning" variant="contained" disabled={saving}>
                        {saving ? 'Saving...' : 'Yes, Update'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
                <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
                    {deleteStep === 1 ? "Delete Order - Warning 1" : "Delete Order - Warning 2"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: 'error.main', fontWeight: 500 }}>
                        {deleteStep === 1
                            ? "Are you sure you want to delete this order? This action cannot be undone."
                            : "FINAL WARNING: You are about to permanently delete this order and all its data. Are you absolutely sure?"}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteOpen(false)} color="inherit">Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        {deleteStep === 1 ? "Proceed" : "Yes, Delete Permanently"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Full Details Modal */}
            <Dialog
                open={detailsOpen}
                onClose={handleDetailsClose}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Order Details
                    <IconButton onClick={handleDetailsClose}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedOrder && (
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Box
                                    component="img"
                                    src={selectedOrder.sampleImageUrl || 'https://via.placeholder.com/400x300?text=No+Image'}
                                    alt={selectedOrder.name}
                                    sx={{
                                        width: '100%',
                                        borderRadius: 2,
                                        maxHeight: 500,
                                        objectFit: 'contain',
                                        bgcolor: '#f5f5f5'
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h5" fontWeight="bold" gutterBottom>
                                    {selectedOrder.name}
                                </Typography>

                                <Box sx={{ mb: 2 }}>
                                    {renderStatusChip(selectedOrder)}
                                </Box>

                                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" gutterBottom>
                                    Telecaller
                                </Typography>
                                <Typography variant="body1" paragraph>
                                    {selectedOrder.telecaller}
                                </Typography>

                                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" gutterBottom>
                                    Assigned Editors
                                </Typography>
                                <Typography variant="body1" paragraph>
                                    {selectedOrder.assignedEditorNames?.join(', ') || 'Unassigned'}
                                </Typography>

                                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" gutterBottom>
                                    Created At
                                </Typography>
                                <Typography variant="body1" paragraph>
                                    {selectedOrder.createdAt ? new Date(selectedOrder.createdAt.seconds * 1000).toLocaleString() : 'N/A'}
                                </Typography>

                                {selectedOrder.remark && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fff8e1', borderRadius: 2, border: '1px dashed #ffe0b2' }}>
                                        <Typography variant="subtitle2" fontWeight="bold" color="warning.dark">
                                            Remark
                                        </Typography>
                                        <Typography variant="body2">
                                            {selectedOrder.remark}
                                        </Typography>
                                    </Box>
                                )}
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDetailsClose}>Close</Button>
                    <Button
                        variant="contained"
                        onClick={(e) => {
                            handleDetailsClose();
                            handleEditClick(e, selectedOrder);
                        }}
                        startIcon={<EditIcon />}
                    >
                        Edit
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Detail Popover */}
            <Popover
                id="mouse-over-popover"
                sx={{
                    pointerEvents: 'none',
                }}
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                onClose={handlePopoverClose}
                disableRestoreFocus
            >
                {popoverOrder && (
                    <Box sx={{ p: 2, maxWidth: 320 }}>
                        <Typography variant="h6" gutterBottom color="primary">{popoverOrder.name}</Typography>
                        {popoverOrder.sampleImageUrl && (
                            <Box component="img" src={popoverOrder.sampleImageUrl} sx={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 1, mb: 1 }} />
                        )}
                        <Typography variant="body2" gutterBottom><strong>Telecaller:</strong> {popoverOrder.telecaller}</Typography>
                        <Typography variant="body2" gutterBottom><strong>Assigned:</strong> {popoverOrder.assignedEditorNames?.join(', ')}</Typography>
                        <Typography variant="body2" gutterBottom component="div"><strong>Status:</strong> {renderStatusChip(popoverOrder)}</Typography>
                        <Typography variant="body2" gutterBottom><strong>Created:</strong> {popoverOrder.createdAt ? new Date(popoverOrder.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</Typography>
                        {popoverOrder.remark && (
                            <Box sx={{ mt: 1, bgcolor: '#f5f5f5', p: 1, borderRadius: 1 }}>
                                <Typography variant="caption" fontWeight="bold">Remark:</Typography>
                                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>{popoverOrder.remark}</Typography>
                            </Box>
                        )}
                    </Box>
                )}
            </Popover>
        </Box>
    );
};

export default OrdersList;