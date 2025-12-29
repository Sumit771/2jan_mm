import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Avatar,
    Stack,
    CircularProgress,
    Grid,
    Card,
    CardContent,
    Rating,
    Tooltip
} from '@mui/material';
import { Block as BlockIcon, CheckCircle as CheckCircleIcon, People, PersonOff, Star, TrendingUp, NewReleases, VerifiedUser as VerifiedUserIcon } from '@mui/icons-material';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

const EditorManagement = () => {
    const [editors, setEditors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingOrders, setPendingOrders] = useState({});
    const [completedOrders, setCompletedOrders] = useState({});
    const [confirmDialog, setConfirmDialog] = useState({ open: false, editorId: null, editorName: '', action: 'terminate' });

    useEffect(() => {
        const qUsers = query(collection(db, 'users'), where('role', '==', 'editor'));

        const unsubUsers = onSnapshot(qUsers, (snapshot) => {
            const editorsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setEditors(editorsList);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching editors:", error);
            toast.error("Failed to load editors");
            setLoading(false);
        });

        // Fetch pending orders to show active workload details
        const qOrders = query(collection(db, 'orders'));
        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            const pCounts = {};
            const cCounts = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.assignedEditorEmails && Array.isArray(data.assignedEditorEmails)) {
                    data.assignedEditorEmails.forEach(email => {
                        const isCompletedByEditor = data.status === 'completed' || (data.completedBy && data.completedBy.includes(email));

                        if (isCompletedByEditor) {
                            cCounts[email] = (cCounts[email] || 0) + 1;
                        } else if (data.status === 'pending' || data.status === 'in-progress') {
                            pCounts[email] = (pCounts[email] || 0) + 1;
                        }
                    });
                }
            });
            setPendingOrders(pCounts);
            setCompletedOrders(cCounts);
        });

        return () => {
            unsubUsers();
            unsubOrders();
        };
    }, []);


    const handleStatusToggle = (editor) => {
        if (editor.status === 'Active' || !editor.status) {
            // Opening warning dialog for termination
            setConfirmDialog({
                open: true,
                editorId: editor.id,
                editorName: editor.displayName,
                action: 'terminate'
            });
        } else {
            setConfirmDialog({
                open: true,
                editorId: editor.id,
                editorName: editor.displayName,
                action: 'reactivate'
            });
        }
    };

    const handleConfirmAction = () => {
        if (confirmDialog.editorId) {
            const status = confirmDialog.action === 'terminate' ? 'Terminated' : 'Active';
            updateEditorStatus(confirmDialog.editorId, status);
            setConfirmDialog({ ...confirmDialog, open: false });
        }
    };

    const updateEditorStatus = async (uid, newStatus) => {
        try {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, { status: newStatus });

            toast.success(`Editor status updated to ${newStatus}`);
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        }
    };

    const toggleSelfOrderPermission = async (editor) => {
        try {
            const userRef = doc(db, 'users', editor.id);
            const newStatus = !editor.selfOrderApproved;
            await updateDoc(userRef, { selfOrderApproved: newStatus });
            toast.success(`Self-order permission ${newStatus ? 'granted' : 'revoked'} for ${editor.displayName}`);
        } catch (error) {
            console.error("Error updating permission:", error);
            toast.error("Failed to update permission");
        }
    };

    const isNewEditor = (createdAt) => {
        if (createdAt === null) return true;
        if (!createdAt || !createdAt.seconds) return false;
        const joinedDate = new Date(createdAt.seconds * 1000);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return joinedDate > thirtyDaysAgo;
    };

    // Analytics Calculations
    const analytics = {
        total: editors.length,
        active: editors.filter(e => e.status !== 'Terminated').length,
        terminated: editors.filter(e => e.status === 'Terminated').length,
        newEditors: editors.filter(e => isNewEditor(e.createdAt)).length,
        avgRating: editors.length
            ? (editors.reduce((acc, curr) => acc + (curr.performance?.rating || 0), 0) / editors.length).toFixed(1)
            : 0
    };

    if (loading) return <CircularProgress />;

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h5" gutterBottom>Editor Insights & Management</Typography>

            {/* Analytics Dashboard Section */}
            <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Typography color="textSecondary" variant="overline">Total Editors</Typography>
                                    <Typography variant="h4">{analytics.total}</Typography>
                                </Box>
                                <People color="primary" fontSize="large" />
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Typography color="textSecondary" variant="overline">Active</Typography>
                                    <Typography variant="h4">{analytics.active}</Typography>
                                </Box>
                                <TrendingUp color="success" fontSize="large" />
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Typography color="textSecondary" variant="overline">Terminated</Typography>
                                    <Typography variant="h4">{analytics.terminated}</Typography>
                                </Box>
                                <PersonOff color="error" fontSize="large" />
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Typography color="textSecondary" variant="overline">New (30d)</Typography>
                                    <Typography variant="h4">{analytics.newEditors}</Typography>
                                </Box>
                                <NewReleases color="info" fontSize="large" />
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                    <Card>
                        <CardContent>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Typography color="textSecondary" variant="overline">Avg Rating</Typography>
                                    <Typography variant="h4">{analytics.avgRating}</Typography>
                                </Box>
                                <Star color="warning" fontSize="large" />
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <TableContainer component={Paper} sx={{ width: '100%' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Editor</TableCell>
                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Email</TableCell>
                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Joined Date</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Performance (Rating)</TableCell>
                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Active Orders</TableCell>
                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Orders Completed</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {editors.map((editor) => (
                            <TableRow key={editor.id}>
                                <TableCell>
                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Avatar src={editor.photoURL}>{editor.displayName?.charAt(0)}</Avatar>
                                        <Stack direction="column" alignItems="flex-start">
                                            <Typography variant="body2" noWrap sx={{ maxWidth: { xs: 100, sm: 150 } }}>{editor.displayName}</Typography>
                                            {isNewEditor(editor.createdAt) && <Chip label="NEW" color="primary" size="small" sx={{ height: 16, fontSize: '0.6rem', width: 'fit-content' }} />}
                                        </Stack>
                                    </Stack>
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{editor.email}</TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                    {editor.createdAt?.seconds
                                        ? new Date(editor.createdAt.seconds * 1000).toLocaleDateString()
                                        : 'N/A'}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={editor.status || 'Active'}
                                        color={editor.status === 'Terminated' ? 'error' : 'success'}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                    <Rating value={editor.performance?.rating || 0} readOnly precision={0.1} size="small" />
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                    {pendingOrders[editor.email] || 0}
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                    {completedOrders[editor.email] || 0}
                                </TableCell>
                                <TableCell align="right">
                                    <Tooltip title={editor.selfOrderApproved ? "Revoke Self-Order Permission" : "Grant Self-Order Permission"}>
                                        <IconButton
                                            color={editor.selfOrderApproved ? 'success' : 'default'}
                                            onClick={() => toggleSelfOrderPermission(editor)}
                                        >
                                            <VerifiedUserIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <IconButton
                                        color={editor.status === 'Terminated' ? 'success' : 'error'}
                                        onClick={() => handleStatusToggle(editor)}
                                        title={editor.status === 'Terminated' ? "Activate" : "Terminate"}
                                    >
                                        {editor.status === 'Terminated' ? <CheckCircleIcon /> : <BlockIcon />}
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
                <DialogTitle sx={{ color: confirmDialog.action === 'terminate' ? 'error.main' : 'success.main', fontWeight: 'bold' }}>
                    {confirmDialog.action === 'terminate' ? `Terminate ${confirmDialog.editorName}?` : `Reactivate ${confirmDialog.editorName}?`}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {confirmDialog.action === 'terminate' ? (
                            <>
                                <Typography color="error" variant="body1" sx={{ fontWeight: 500 }}>
                                    1. Warning: No new orders can be assigned to this editor.
                                </Typography>
                                <Typography color="error" variant="body1" sx={{ fontWeight: 500 }}>
                                    2. Warning: The editor will lose access to the dashboard immediately.
                                </Typography>
                                <Typography color="error" variant="body1" sx={{ fontWeight: 500 }}>
                                    3. Warning: Historical data and completed orders will be retained.
                                </Typography>
                            </>
                        ) : (
                            <>
                                <Typography color="success.main" variant="body1" sx={{ fontWeight: 500 }}>
                                    1. Warning: The editor will regain access to the dashboard immediately.
                                </Typography>
                                <Typography color="success.main" variant="body1" sx={{ fontWeight: 500 }}>
                                    2. Warning: New orders can be assigned to this editor.
                                </Typography>
                            </>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>Cancel</Button>
                    <Button onClick={handleConfirmAction} color={confirmDialog.action === 'terminate' ? "error" : "success"} variant="contained">
                        {confirmDialog.action === 'terminate' ? "Confirm Termination" : "Confirm Reactivation"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EditorManagement;