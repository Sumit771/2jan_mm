import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, where, getDocs, deleteDoc, writeBatch, addDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import UserManagement from './UserManagement';
import { useAuth } from '../context/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Box,
    Container,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    CircularProgress,
    Avatar,
    AvatarGroup,
    Tooltip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TablePagination,
    TextField,
    Popover,
    Rating,
    Grid,
    useTheme,
    useMediaQuery,
    LinearProgress,
    Slider
} from '@mui/material';
import { Person as PersonIcon, AdminPanelSettings as AdminIcon, Group as GroupIcon, PictureAsPdf as PdfIcon, Edit as EditIcon, Delete as DeleteIcon, CloudUpload as CloudUploadIcon, Close as CloseIcon, VerifiedUser as VerifiedUserIcon, Check as CheckIcon, EmojiEvents as TrophyIcon, TrackChanges as TargetIcon, RateReview as ReviewIcon } from '@mui/icons-material';

const EditOrderDialog = ({ open, onClose, order, editors, onSave, onDelete }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [form, setForm] = useState({
        name: '',
        telecaller: '',
        status: 'pending',
        assignedEditorEmails: [],
        assignedEditorNames: [],
        sampleImageUrl: '',
        remark: ''
    });
    const [file, setFile] = useState(null);

    useEffect(() => {
        if (order && open) {
            setForm({
                name: order.name || '',
                telecaller: order.telecaller || '',
                status: order.status || 'pending',
                assignedEditorEmails: order.assignedEditorEmails || [],
                assignedEditorNames: order.assignedEditorNames || [],
                sampleImageUrl: order.sampleImageUrl || '',
                remark: order.remark || ''
            });
            setFile(null);
        }
    }, [order, open]);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleEditorChange = (event) => {
        const { target: { value } } = event;
        const selectedEmails = typeof value === 'string' ? value.split(',') : value;

        const selectedNames = selectedEmails.map(email => {
            const editor = editors.find(e => e.email === email);
            return editor ? editor.name : email;
        });

        setForm({
            ...form,
            assignedEditorEmails: selectedEmails,
            assignedEditorNames: selectedNames,
        });
    };

    const handleSave = () => {
        onSave(form, file);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Edit Order
                <IconButton onClick={onDelete} color="error" title="Delete Order">
                    <DeleteIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <TextField label="Client/Order Name" name="name" value={form.name} onChange={handleChange} fullWidth />
                    <TextField label="Telecaller" name="telecaller" value={form.telecaller} onChange={handleChange} fullWidth />
                    <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select name="status" value={form.status} label="Status" onChange={handleChange}>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="in-progress">In-Progress</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>Reassign Editor(s)</InputLabel>
                        <Select
                            multiple
                            value={form.assignedEditorEmails}
                            label="Reassign Editor(s)"
                            onChange={handleEditorChange}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((email) => {
                                        const name = editors.find(e => e.email === email)?.name || email;
                                        return <Chip key={email} label={name} size="small" />;
                                    })}
                                </Box>
                            )}
                        >
                            {editors.map((e) => (
                                <MenuItem key={e.email} value={e.email}>
                                    {e.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField label="Image URL" name="sampleImageUrl" value={form.sampleImageUrl} onChange={handleChange} fullWidth />
                    <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} fullWidth>
                        Or Upload New Image
                        <input type="file" hidden onChange={(e) => setFile(e.target.files[0])} />
                    </Button>
                    {file && <Typography variant="caption">{file.name}</Typography>}
                    <TextField label="Remark" name="remark" value={form.remark} onChange={handleChange} fullWidth multiline rows={3} />
                </Box>
            </DialogContent>
            <DialogActions sx={{ pb: { xs: 2, sm: 1 } }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained">Save Changes</Button>
            </DialogActions>
        </Dialog>
    );
};

const TeamLeaderDashboard = ({ highlightOrderId, onClearHighlight }) => {
    const { user } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [orders, setOrders] = useState([]);
    const [editors, setEditors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('dashboard'); // 'dashboard' | 'users'
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [filterEditor, setFilterEditor] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterMonth, setFilterMonth] = useState('all');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [ratingDialog, setRatingDialog] = useState({ open: false, order: null, newValue: 0 });
    const [exporting, setExporting] = useState(false);

    // State for modals and popovers from OrdersList
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [pendingSave, setPendingSave] = useState(null);
    const [saving, setSaving] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmStep, setConfirmStep] = useState(0);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteStep, setDeleteStep] = useState(0);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [approvalDialog, setApprovalDialog] = useState({ open: false, order: null });

    const [targetDialogOpen, setTargetDialogOpen] = useState(false);
    const [targetEditorId, setTargetEditorId] = useState('');
    const [targetValue, setTargetValue] = useState(0);
    const [targetMax, setTargetMax] = useState(0);

    const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
    const [reviewOrder, setReviewOrder] = useState(null);

    // Cleanup notifications older than 12 hours
    useEffect(() => {
        const cleanupNotifications = async () => {
            if (!user) return;
            try {
                const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
                const q = query(collection(db, 'notifications'), where('createdAt', '<=', cutoff));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const batch = writeBatch(db);
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    console.log(`Cleaned up ${snapshot.size} old notifications.`);
                }
            } catch (error) {
                console.error("Error cleaning up notifications:", error);
            }
        };
        cleanupNotifications();
    }, [user]);

    useEffect(() => {
        // Fetch all orders ordered by creation date
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

        // Fetch editors dynamically from users collection
        const usersQ = query(collection(db, 'users'), where('role', '==', 'editor'));
        const unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
            const fetchedEditors = snapshot.docs.map(doc => ({
                id: doc.id,
                email: doc.data().email,
                name: doc.data().displayName || doc.data().email,
                photoURL: doc.data().photoURL,
                status: doc.data().status,
                targets: doc.data().targets || {}
            })).filter(e => e.status !== 'Terminated');
            setEditors(fetchedEditors);
        }, (error) => {
            console.error("Error fetching editors:", error);
            toast.error("Failed to fetch editors list.");
        });

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedOrders = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setOrders(fetchedOrders);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching orders:", error);
            toast.error("Access denied. Check permissions.");
            setLoading(false);
        });

        return () => {
            unsubscribe();
            unsubscribeUsers();
        };
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

    useEffect(() => {
        if (targetDialogOpen && targetEditorId) {
            const editor = editors.find(e => e.id === targetEditorId);
            if (editor) {
                const now = new Date();
                const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                // Calculate Max (Total Assigned in Current Month)
                const assignedCount = orders.filter(o => {
                    if (!o.assignedEditorEmails?.includes(editor.email)) return false;
                    if (!o.createdAt?.toDate) return false;
                    const d = o.createdAt.toDate();
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length;

                setTargetMax(assignedCount);

                // Set initial value from DB, clamped to max
                const dbTarget = editor.targets?.[currentMonthKey] || 0;
                setTargetValue(Math.min(dbTarget, assignedCount));
            } else {
                setTargetValue(0);
                setTargetMax(0);
            }
        }
    }, [targetEditorId, targetDialogOpen, orders, editors]);

    const handleRateOrder = async (order, newValue) => {
        try {
            // 1. Update Order Rating
            const orderRef = doc(db, 'orders', order.id);
            await updateDoc(orderRef, { rating: newValue });

            // 2. Update Editor(s) Average Rating
            if (order.assignedEditorEmails && order.assignedEditorEmails.length > 0) {
                for (const email of order.assignedEditorEmails) {
                    const editor = editors.find(e => e.email === email);
                    if (editor && editor.id) {
                        // Recalculate average for this editor
                        const ordersQ = query(collection(db, 'orders'), where('assignedEditorEmails', 'array-contains', email));
                        const snapshot = await getDocs(ordersQ);

                        let totalRating = 0;
                        let count = 0;

                        snapshot.docs.forEach(doc => {
                            const data = doc.data();
                            // Use the new value for the current order, otherwise use stored value
                            const r = (doc.id === order.id) ? newValue : (data.rating || 0);
                            if (r > 0) {
                                totalRating += r;
                                count++;
                            }
                        });

                        const avg = count > 0 ? totalRating / count : 0;

                        await updateDoc(doc(db, 'users', editor.id), {
                            'performance.rating': avg
                        });
                    }
                }
            }
            toast.success("Rating updated");
        } catch (error) {
            console.error("Error updating rating:", error);
            toast.error("Failed to update rating");
        }
    };

    const handleConfirmRating = async () => {
        if (ratingDialog.order) {
            await handleRateOrder(ratingDialog.order, ratingDialog.newValue);
        }
        setRatingDialog({ open: false, order: null, newValue: 0 });
    };

    const handleSetupAdmin = async () => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                role: 'team-leader',
                createdAt: serverTimestamp()
            }, { merge: true });
            toast.success("Admin profile created! Refresh the page.");
        } catch (error) {
            toast.error("Setup failed: " + error.message);
        }
    };

    const timeAgo = (date) => {
        if (!date) return 'N/A';
        const seconds = Math.floor((new Date() - date) / 1000);
        const days = Math.floor(seconds / 86400);

        if (days > 365) {
            const years = Math.floor(days / 365);
            return `${years} year${years > 1 ? 's' : ''} ago`;
        }
        if (days > 30) {
            const months = Math.floor(days / 30);
            return `${months} month${months > 1 ? 's' : ''} ago`;
        }
        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
        const hours = Math.floor(seconds / 3600);
        if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
        const minutes = Math.floor(seconds / 60);
        if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
        return `a few seconds ago`;
    };

    const handleDetailsOpen = (order) => {
        setSelectedOrder(order);
        setDetailsOpen(true);
    };

    const handleDetailsClose = () => {
        setDetailsOpen(false);
        setSelectedOrder(null);
    };

    const handleEditOpen = (order) => {
        setEditingOrder(order);
        setEditOpen(true);
    };

    const handleEditClose = () => {
        setEditOpen(false);
        setEditingOrder(null);
        setConfirmStep(0);
        setConfirmOpen(false);
    };

    const handleEditSaveRequest = (formData, file) => {
        setPendingSave({ data: formData, file });
        setConfirmStep(1);
        setConfirmOpen(true);
    };

    const handleConfirmSave = async () => {
        if (confirmStep === 1) {
            setConfirmStep(2);
        } else {
            setSaving(true);
            try {
                const { data, file } = pendingSave;
                let imageUrl = data.sampleImageUrl;
                if (file) {
                    const storageRef = ref(storage, `samples/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    imageUrl = await getDownloadURL(storageRef);
                }

                const orderRef = doc(db, 'orders', editingOrder.id);
                await updateDoc(orderRef, {
                    name: data.name,
                    telecaller: data.telecaller,
                    status: data.status,
                    assignedEditorEmails: data.assignedEditorEmails,
                    assignedEditorNames: data.assignedEditorNames,
                    assignmentType: data.assignedEditorEmails.length > 1 ? 'broadcast' : 'direct',
                    sampleImageUrl: imageUrl,
                    remark: data.remark
                });

                toast.success('Order updated successfully');
                handleEditClose();
            } catch (error) {
                console.error(error);
                toast.error('Failed to update order');
            } finally {
                setSaving(false);
            }
        }
    };

    const handleDeleteClick = (order) => {
        setOrderToDelete(order);
        setDeleteStep(1);
        setDeleteOpen(true);
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

    const handleOpenApproval = (order) => {
        setApprovalDialog({ open: true, order });
    };

    const handleApproveOrder = async () => {
        if (!approvalDialog.order) return;
        try {
            await updateDoc(doc(db, 'orders', approvalDialog.order.id), { status: 'pending' });
            toast.success("Order approved!");
            setApprovalDialog({ open: false, order: null });
        } catch (error) {
            toast.error("Failed to approve order");
        }
    };

    const handleApproveEditorAndOrder = async () => {
        if (!approvalDialog.order) return;
        try {
            const editorEmail = approvalDialog.order.assignedEditorEmails[0];
            const editor = editors.find(e => e.email === editorEmail);
            if (editor) {
                await updateDoc(doc(db, 'users', editor.id), { selfOrderApproved: true });
            }
            await updateDoc(doc(db, 'orders', approvalDialog.order.id), { status: 'pending' });
            toast.success("Editor approved for self-orders & Order approved!");
            setApprovalDialog({ open: false, order: null });
        } catch (error) {
            toast.error("Failed to approve");
        }
    };

    const handleSaveTarget = async () => {
        if (!targetEditorId) return;
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        try {
            await updateDoc(doc(db, 'users', targetEditorId), {
                [`targets.${currentMonthKey}`]: targetValue
            });
            toast.success("Monthly target updated");
            setTargetDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to update target");
        }
    };

    const handleReviewClick = (order) => {
        setReviewOrder(order);
        setReviewDialogOpen(true);
    };

    const handleApproveEdit = async (trustEditor) => {
        if (!reviewOrder || !reviewOrder.pendingEdit) return;

        try {
            let { changes, editorEmail, editorName } = reviewOrder.pendingEdit;

            if (!changes) {
                const { editorEmail: e, editorName: n, timestamp, ...rest } = reviewOrder.pendingEdit;
                changes = rest;
            }

            const safeEditorEmail = editorEmail || 'unknown';
            const safeEditorName = editorName || 'Unknown';

            const orderRef = doc(db, 'orders', reviewOrder.id);

            // 1. Apply changes and remove pending flags
            await updateDoc(orderRef, {
                ...changes,
                hasPendingEdit: false,
                pendingEdit: null
            });

            // 2. Log modification
            try {
                await addDoc(collection(db, `orders/${reviewOrder.id}/history`), {
                    action: 'edit_approved',
                    editedBy: safeEditorEmail,
                    editorName: safeEditorName,
                    approvedBy: user.email,
                    changes: changes,
                    timestamp: serverTimestamp()
                });
            } catch (historyError) {
                console.error("Error logging history:", historyError);
            }

            // 3. If trusting editor, update user profile
            if (trustEditor) {
                const editor = editors.find(e => e.email === safeEditorEmail);
                if (editor) {
                    try {
                        await updateDoc(doc(db, 'users', editor.id), {
                            autoApproveEdits: true
                        });
                        toast.success(`Approved & ${safeEditorName} is now trusted for future edits.`);
                    } catch (userError) {
                        console.error("Error updating user profile:", userError);
                        toast.warning(`Order approved, but failed to update editor permissions.`);
                    }
                }
            } else {
                toast.success("Edit approved successfully.");
            }

            setReviewDialogOpen(false);
            setReviewOrder(null);
        } catch (error) {
            console.error(error);
            toast.error("Failed to approve edit.");
        }
    };

    const getBase64ImageFromURL = (url) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.setAttribute('crossOrigin', 'anonymous');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/jpeg');
                resolve(dataURL);
            };
            img.onerror = () => {
                resolve(null); // Resolve with null if image fails to load
            };
            img.src = url;
        });
    };

    const availableYears = useMemo(() => {
        const years = new Set();
        orders.forEach(order => {
            if (order.createdAt?.toDate) {
                years.add(order.createdAt.toDate().getFullYear());
            }
        });
        years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a);
    }, [orders]);

    const availableMonths = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const date = new Date(filterYear, i, 1);
            return {
                key: `${filterYear}-${i}`,
                label: date.toLocaleString('default', { month: 'long', year: 'numeric' })
            };
        });
    }, [filterYear]);

    const filteredOrders = useMemo(() => orders.filter(order => {
        // Filter by Editor
        if (filterEditor !== 'all' && !order.assignedEditorEmails?.includes(filterEditor)) {
            return false;
        }

        // Filter by Status
        if (filterStatus !== 'all' && order.status !== filterStatus) {
            return false;
        }

        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : null;
        if (!orderDate) return false; // Don't show orders without a date

        // Filter by Month
        if (filterMonth !== 'all') {
            const [year, month] = filterMonth.split('-').map(Number);
            if (orderDate.getFullYear() !== year || orderDate.getMonth() !== month) {
                return false;
            }
        }

        // Filter by Search Query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const nameMatch = order.name?.toLowerCase().includes(query);
            const telecallerMatch = order.telecaller?.toLowerCase().includes(query);
            if (!nameMatch && !telecallerMatch) {
                return false;
            }
        }

        return true;
    }), [orders, filterEditor, filterStatus, filterMonth, filterYear, searchQuery]);

    const handleExportPDF = async () => {
        setExporting(true);
        try {
            const doc = new jsPDF();
            const tableColumn = ["Image", "Client / Order", "Telecaller", "Status", "Assigned Editors", "Created At"];
            const tableRows = [];
            const rowImages = {};

            const promises = filteredOrders.map(async (order) => {
                let imgData = null;
                if (order.sampleImageUrl) {
                    imgData = await getBase64ImageFromURL(order.sampleImageUrl);
                }
                return { ...order, imgData };
            });

            const processedOrders = await Promise.all(promises);

            processedOrders.forEach((order, index) => {
                if (order.imgData) {
                    rowImages[index] = order.imgData;
                }
                const orderData = [
                    '', // Image placeholder
                    order.name,
                    order.telecaller,
                    order.status,
                    order.assignedEditorNames?.join(', ') || '',
                    order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-GB') : '-'
                ];
                tableRows.push(orderData);
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 20,
                rowPageBreak: 'avoid',
                bodyStyles: { valign: 'middle' },
                columnStyles: { 0: { cellWidth: 25, minCellHeight: 25 } },
                didDrawCell: (data) => {
                    if (data.column.index === 0 && data.cell.section === 'body') {
                        const img = rowImages[data.row.index];
                        if (img) {
                            const padding = 2;
                            const dim = data.cell.height - (padding * 2);
                            doc.addImage(img, 'JPEG', data.cell.x + padding, data.cell.y + padding, dim, dim);
                        }
                    }
                }
            });

            const totalOrders = filteredOrders.length;
            const completedCount = filteredOrders.filter(o => o.status === 'completed').length;
            const pendingCount = filteredOrders.filter(o => o.status === 'pending').length;
            const inProgressCount = filteredOrders.filter(o => o.status === 'in-progress').length;

            const finalY = doc.lastAutoTable.finalY || 30;
            doc.text(`Summary: Total: ${totalOrders} | Completed: ${completedCount} | Pending: ${pendingCount} | In-Progress: ${inProgressCount}`, 14, finalY + 10);

            doc.text("Orders Report", 14, 15);
            doc.save(`orders_report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("PDF Export failed", error);
            toast.error("Failed to export PDF.");
        } finally {
            setExporting(false);
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const paginatedOrders = useMemo(() => {
        return filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filteredOrders, page, rowsPerPage]);

    if (view === 'users') {
        return <UserManagement onBack={() => setView('dashboard')} />;
    }

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 4 }, mb: { xs: 2, md: 4 }, px: { xs: 1, md: 3 } }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4} sx={{ flexDirection: { xs: 'column', lg: 'row' }, gap: 2, alignItems: { xs: 'stretch', lg: 'center' } }}>

                <Box display="flex" gap={2} flexWrap="wrap" sx={{ justifyContent: { xs: 'center', lg: 'flex-start' }, width: { xs: '100%', lg: 'auto' } }}>
                    <FormControl size="small" sx={{ minWidth: 120, width: { xs: '100%', sm: 'auto' }, bgcolor: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(5px)', borderRadius: 1 }}>
                        <InputLabel>Filter by Year</InputLabel>
                        <Select
                            value={filterYear}
                            label="Filter by Year"
                            onChange={(e) => {
                                setFilterYear(e.target.value);
                                setFilterMonth('all'); // Reset month filter
                                setPage(0);
                            }}
                        >
                            {availableYears.map(year => (
                                <MenuItem key={year} value={year}>{year}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 180, width: { xs: '100%', sm: 'auto' }, bgcolor: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(5px)', borderRadius: 1 }}>
                        <InputLabel>Filter by Month</InputLabel>
                        <Select
                            value={filterMonth}
                            label="Filter by Month"
                            onChange={(e) => {
                                setFilterMonth(e.target.value);
                                setPage(0);
                            }}
                        >
                            <MenuItem value="all">All Months</MenuItem>
                            {availableMonths.map(month => (
                                <MenuItem key={month.key} value={month.key}>{month.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 180, width: { xs: '100%', sm: 'auto' }, bgcolor: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(5px)', borderRadius: 1 }}>
                        <InputLabel>Filter by Status</InputLabel>
                        <Select
                            value={filterStatus}
                            label="Filter by Status"
                            onChange={(e) => {
                                setFilterStatus(e.target.value);
                                setPage(0);
                            }}
                        >
                            <MenuItem value="all">All Statuses</MenuItem>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="in-progress">In-Progress</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                            <MenuItem value="waiting-approval">Waiting Approval</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        size="small"
                        label="Search Order / Telecaller"
                        variant="outlined"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(0);
                        }}
                        sx={{ minWidth: 180, width: { xs: '100%', sm: 'auto' }, bgcolor: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(5px)', borderRadius: 1 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 200, width: { xs: '100%', sm: 'auto' }, bgcolor: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(5px)', borderRadius: 1 }}>
                        <InputLabel>Filter by Editor</InputLabel>
                        <Select
                            value={filterEditor}
                            label="Filter by Editor"
                            onChange={(e) => {
                                setFilterEditor(e.target.value);
                                setPage(0);
                            }}
                        >
                            <MenuItem value="all">All Editors</MenuItem>
                            {editors.map((editor) => (
                                <MenuItem key={editor.email} value={editor.email}>
                                    {editor.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button
                        variant="contained"
                        startIcon={<GroupIcon />}
                        onClick={() => setView('users')}
                        size="small"
                        sx={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', width: { xs: '100%', sm: 'auto' } }}
                    >
                        Manage Users
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <PdfIcon />}
                        onClick={handleExportPDF}
                        size="small"
                        color="error"
                        disabled={exporting}
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                        {exporting ? 'Exporting...' : 'Export PDF'}
                    </Button>
                    {/* <Button
                        variant="outlined"
                        startIcon={<AdminIcon />}
                        onClick={handleSetupAdmin}
                        size="small"
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                        Setup Admin Access
                    </Button> */}
                    <Button
                        variant="outlined"
                        startIcon={<TargetIcon />}
                        onClick={() => setTargetDialogOpen(true)}
                        size="small"
                        color="secondary"
                        sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                        Set Target
                    </Button>
                </Box>
            </Box>

            <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', overflowX: { xs: 'hidden', sm: 'auto' }, backgroundColor: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(10px)' }}>
                <Table sx={{ tableLayout: { xs: 'fixed', sm: 'auto' } }}>
                    <TableHead sx={{ bgcolor: 'rgba(248, 249, 250, 0.6)' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600, px: { xs: 1, sm: 2 }, width: { xs: '60px', sm: 'auto' } }}>Image</TableCell>
                            <TableCell sx={{ fontWeight: 600, px: { xs: 1, sm: 2 } }}>Client / Order</TableCell>
                            <TableCell sx={{ fontWeight: 600, px: { xs: 1, sm: 2 }, width: { xs: '90px', sm: 'auto' } }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }}>Rating</TableCell>
                            <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>Assigned Editors</TableCell>
                            <TableCell sx={{ fontWeight: 600, display: { xs: 'none', lg: 'table-cell' } }}>Created At</TableCell>
                            <TableCell sx={{ fontWeight: 600, px: { xs: 1, sm: 2 }, width: { xs: '70px', sm: 'auto' } }} align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedOrders.map((order) => (
                            <TableRow key={order.id} hover>
                                <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                                    <Tooltip title={order.sampleImageUrl ? <img src={order.sampleImageUrl} style={{ maxWidth: 300, borderRadius: '4px' }} /> : "No Image"} arrow>
                                        <Avatar
                                            src={order.sampleImageUrl}
                                            variant="rounded"
                                            sx={{ width: { xs: 40, sm: 56 }, height: { xs: 40, sm: 56 }, cursor: 'pointer' }}
                                            onClick={() => handleDetailsOpen(order)}
                                        />
                                    </Tooltip>
                                </TableCell>
                                <TableCell onClick={() => handleDetailsOpen(order)} sx={{ cursor: 'pointer', px: { xs: 1, sm: 2 } }}>
                                    <Typography
                                        variant="subtitle2"
                                        fontWeight={600}
                                        noWrap
                                        sx={{ '&:hover': { textDecoration: 'underline', color: 'primary.main' } }}
                                    >
                                        {order.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                                        {order.telecaller}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                                    <Box display="flex" gap={0.5} flexDirection="column" alignItems="flex-start">
                                        <Chip
                                            label={order.status === 'waiting-approval' ? 'Waiting Approval' : order.status}
                                            color={order.status === 'completed' ? 'success' : order.status === 'in-progress' ? 'primary' : order.status === 'waiting-approval' ? 'warning' : 'default'}
                                            size="small"
                                            sx={{ textTransform: 'capitalize' }}
                                        />
                                        {order.isSelfOrder && (
                                            <Chip
                                                label="Self Order"
                                                size="small"
                                                variant="outlined"
                                                color="info"
                                                sx={{ height: 20, fontSize: '0.65rem' }}
                                            />
                                        )}
                                        {order.hasPendingEdit && (
                                            <Chip
                                                label="Edit Pending"
                                                size="small"
                                                color="secondary"
                                                sx={{ height: 20, fontSize: '0.65rem' }}
                                            />
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                    <Tooltip title={order.status !== 'completed' ? "Rating is only available for completed orders" : ""}>
                                        {/* Div wrapper is necessary for Tooltip on a read-only/disabled component */}
                                        <div>
                                            <Rating
                                                name={`rating-${order.id}`}
                                                value={order.rating || 0}
                                                onChange={(event, newValue) => {
                                                    setRatingDialog({ open: true, order, newValue });
                                                }}
                                                size="small"
                                                readOnly={order.status !== 'completed'}
                                            />
                                        </div>
                                    </Tooltip>
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                    <AvatarGroup max={4} sx={{ justifyContent: 'center' }}>
                                        {order.assignedEditorEmails?.map((email, index) => {
                                            const editor = editors.find(e => e.email === email);
                                            const name = order.assignedEditorNames?.[index] || email;
                                            //onst name = order.assignedEditorNames;
                                            return (
                                                <Tooltip key={email} title={name}>
                                                    <Avatar src={editor?.photoURL} alt={name} sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                                                        {name?.charAt(0)}
                                                    </Avatar>
                                                </Tooltip>
                                            );
                                        })}
                                    </AvatarGroup>
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                                    <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                                        {timeAgo(order.createdAt?.toDate())}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {order.createdAt?.toDate().toLocaleDateString('en-GB')}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}>
                                    {order.hasPendingEdit ? (
                                        <Button
                                            variant="contained"
                                            color="info"
                                            size="small"
                                            onClick={() => handleReviewClick(order)}
                                            startIcon={<ReviewIcon />}
                                            sx={{ fontSize: '0.7rem', py: 0.5 }}
                                        >
                                            Review
                                        </Button>
                                    ) : order.status === 'waiting-approval' ? (
                                        <Button
                                            variant="contained"
                                            color="warning"
                                            size="small"
                                            onClick={() => handleOpenApproval(order)}
                                            sx={{ fontSize: '0.7rem', py: 0.5 }}
                                        >
                                            Approve
                                        </Button>
                                    ) : (
                                        <Box>
                                            <IconButton onClick={() => handleEditOpen(order)} size="small" color="primary"><EditIcon /></IconButton>
                                            <IconButton onClick={() => handleDeleteClick(order)} size="small" color="error"><DeleteIcon /></IconButton>
                                        </Box>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {paginatedOrders.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                                    No orders found
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                rowsPerPageOptions={[10, 20, 50]}
                component="div"
                count={filteredOrders.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />

            {/* Rating Confirmation Dialog */}
            <Dialog open={ratingDialog.open} onClose={() => setRatingDialog({ ...ratingDialog, open: false })}>
                <DialogTitle>Confirm Rating Change</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to update the rating for <strong>{ratingDialog.order?.name}</strong> to {ratingDialog.newValue} stars?
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ pb: { xs: 2, sm: 1 } }}>
                    <Button onClick={() => setRatingDialog({ ...ratingDialog, open: false })}>Cancel</Button>
                    <Button onClick={handleConfirmRating} variant="contained" autoFocus>
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Details Modal */}
            <Dialog open={detailsOpen} onClose={handleDetailsClose} maxWidth="md" fullWidth fullScreen={isMobile}>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Order Details
                    <IconButton onClick={handleDetailsClose}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedOrder && (
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Box
                                    component="img"
                                    src={selectedOrder.sampleImageUrl || 'https://via.placeholder.com/400x300?text=No+Image'}
                                    alt={selectedOrder.name}
                                    sx={{ width: '100%', borderRadius: 2, maxHeight: 500, objectFit: 'contain', bgcolor: '#f5f5f5' }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="h5" fontWeight="bold" gutterBottom>{selectedOrder.name}</Typography>
                                <Chip label={selectedOrder.status} color={selectedOrder.status === 'completed' ? 'success' : 'info'} size="small" sx={{ mb: 2 }} />
                                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">Telecaller</Typography>
                                <Typography variant="body1" paragraph>{selectedOrder.telecaller}</Typography>
                                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">Assigned Editors</Typography>
                                <Typography variant="body1" paragraph>{selectedOrder.assignedEditorNames?.join(', ') || 'Unassigned'}</Typography>
                                {selectedOrder.status === 'completed' && (
                                    <>
                                        <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">Rating</Typography>
                                        <Rating value={selectedOrder.rating || 0} readOnly size="small" sx={{ mb: 2 }} />
                                    </>
                                )}
                                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">Created At</Typography>
                                <Typography variant="body1" paragraph>{selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleString() : 'N/A'}</Typography>
                                {selectedOrder.remark && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fff8e1', borderRadius: 2 }}>
                                        <Typography variant="subtitle2" fontWeight="bold" color="warning.dark">Remark</Typography>
                                        <Typography variant="body2">{selectedOrder.remark}</Typography>
                                    </Box>
                                )}
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions sx={{ pb: { xs: 2, sm: 1 } }}>
                    <Button onClick={handleDetailsClose}>Close</Button>
                    <Button variant="contained" onClick={() => { handleDetailsClose(); handleEditOpen(selectedOrder); }} startIcon={<EditIcon />}>Edit</Button>
                </DialogActions>
            </Dialog>

            {/* Edit Dialog */}
            <EditOrderDialog
                open={editOpen}
                onClose={handleEditClose}
                order={editingOrder}
                editors={editors}
                onSave={handleEditSaveRequest}
                onDelete={() => handleDeleteClick(editingOrder)}
            />

            {/* Confirm Save Dialog */}
            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <DialogTitle>{confirmStep === 1 ? "Confirm Update" : "Final Warning"}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {confirmStep === 1
                            ? "Are you sure you want to update this order?"
                            : "This will change the order details for editors and cannot be undone easily. Proceed?"}
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ pb: { xs: 2, sm: 1 } }}>
                    <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmSave} color="warning" variant="contained" disabled={saving}>
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
                <DialogActions sx={{ pb: { xs: 2, sm: 1 } }}>
                    <Button onClick={() => setDeleteOpen(false)} color="inherit">Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        {deleteStep === 1 ? "Proceed" : "Yes, Delete Permanently"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Approval Dialog */}
            <Dialog open={approvalDialog.open} onClose={() => setApprovalDialog({ open: false, order: null })}>
                <DialogTitle>Approve Self Order</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <strong>{approvalDialog.order?.name}</strong> created by <strong>{approvalDialog.order?.assignedEditorNames?.[0]}</strong>.
                        <br /><br />
                        Do you want to approve just this order, or approve the editor for future self-orders as well?
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ flexDirection: 'column', gap: 1, p: 2 }}>
                    <Button fullWidth variant="contained" onClick={handleApproveOrder} startIcon={<CheckIcon />}>Approve This Order Only</Button>
                    <Button fullWidth variant="contained" color="success" onClick={handleApproveEditorAndOrder} startIcon={<VerifiedUserIcon />}>Approve Editor for Self Orders</Button>
                    <Button fullWidth onClick={() => setApprovalDialog({ open: false, order: null })}>Cancel</Button>
                </DialogActions>
            </Dialog>

            {/* Set Target Dialog */}
            <Dialog open={targetDialogOpen} onClose={() => setTargetDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Set Monthly Target</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Set the completion target for the current month.
                    </DialogContentText>

                    <FormControl fullWidth sx={{ mb: 3, mt: 1 }}>
                        <InputLabel>Select Editor</InputLabel>
                        <Select
                            value={targetEditorId}
                            label="Select Editor"
                            onChange={(e) => setTargetEditorId(e.target.value)}
                        >
                            {editors.map((editor) => (
                                <MenuItem key={editor.id} value={editor.id}>{editor.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {targetEditorId && (
                        <Box sx={{ px: 2 }}>
                            <Typography gutterBottom>
                                Target: <strong>{targetValue}</strong> / {targetMax} Assigned Orders
                            </Typography>
                            <Slider
                                value={targetValue}
                                onChange={(e, newValue) => setTargetValue(newValue)}
                                valueLabelDisplay="auto"
                                step={1}
                                marks
                                min={0}
                                max={targetMax}
                                disabled={targetMax === 0}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                * Based on orders assigned in {new Date().toLocaleString('default', { month: 'long' })}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTargetDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveTarget} variant="contained" disabled={!targetEditorId}>
                        Save Target
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Review Edit Dialog */}
            <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Review Edit Request</DialogTitle>
                <DialogContent>
                    {reviewOrder && reviewOrder.pendingEdit && (
                        <>
                            <DialogContentText sx={{ mb: 2 }}>
                                Editor <strong>{reviewOrder.pendingEdit.editorName}</strong> wants to modify this order.
                            </DialogContentText>
                            <Box sx={{ mt: 2 }}>
                                {(() => {
                                    const changes = reviewOrder.pendingEdit.changes || (({ editorEmail, editorName, timestamp, ...rest }) => rest)(reviewOrder.pendingEdit);
                                    return Object.keys(changes).map(key => (
                                        <Box key={key} sx={{ mb: 1, p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{key}</Typography>
                                            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                                                <Typography sx={{ textDecoration: 'line-through', color: 'error.main', fontSize: '0.9rem' }}>
                                                    {reviewOrder[key] || '(empty)'}
                                                </Typography>
                                                <Typography>→</Typography>
                                                <Typography sx={{ color: 'success.main', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                    {changes[key]}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    ));
                                })()}
                            </Box>
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ flexDirection: 'column', gap: 1, p: 2 }}>
                    <Button fullWidth variant="contained" onClick={() => handleApproveEdit(false)}>Approve This Edit Only</Button>
                    <Button fullWidth variant="contained" color="success" onClick={() => handleApproveEdit(true)}>Approve & Auto-Approve Future Edits</Button>
                    <Button fullWidth color="inherit" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default TeamLeaderDashboard;