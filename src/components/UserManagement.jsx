import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
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
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    CircularProgress,
    Tooltip,
    Avatar,
    DialogContentText,
    useTheme,
    useMediaQuery,
    Rating
} from '@mui/material';
import { Edit as EditIcon, ArrowBack as ArrowBackIcon, Add as AddIcon, Delete as DeleteIcon, AdminPanelSettings as AdminIcon } from '@mui/icons-material';
import { toast } from 'react-toastify';
import CreateUser from './CreateUser';

const UserManagement = ({ onBack }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [formData, setFormData] = useState({ displayName: '', role: 'editor', photoURL: '' });
    const [bbCode, setBbCode] = useState('');
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const userList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(userList);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast.error("Failed to load users.");
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (user) => {
        setCurrentUser(user);
        setFormData({
            displayName: user.displayName || '',
            role: user.role || 'editor',
            photoURL: user.photoURL || ''
        });
        setBbCode('');
        setEditOpen(true);
    };

    const handleSave = async () => {
        if (!currentUser) return;
        try {
            const userRef = doc(db, 'users', currentUser.id);
            await updateDoc(userRef, {
                displayName: formData.displayName,
                role: formData.role,
                photoURL: formData.photoURL
            });
            toast.success("User updated successfully");
            setEditOpen(false);
            fetchUsers(); // Refresh list
        } catch (error) {
            console.error("Error updating user:", error);
            toast.error("Failed to update user");
        }
    };

    const handleDeleteClick = (user) => {
        if (user.email === 'vivek@mm.com') {
            toast.error("Current Team Leader Vivek cannot be removed.");
            return;
        }
        setCurrentUser(user);
        setDeleteOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!currentUser) return;
        try {
            await deleteDoc(doc(db, 'users', currentUser.id));
            toast.success("User deleted successfully");
            setDeleteOpen(false);
            fetchUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
            toast.error("Failed to delete user");
        }
    };

    const handleAvatarClick = (user) => {
        setSelectedUser(user);
        setDetailsOpen(true);
    };

    if (loading) return <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>;

    return (
        <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: 4, px: { xs: 1, sm: 3 } }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { xs: 'stretch', sm: 'center' } }}>
                <Box>
                    <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 1 }}>
                        Back to Dashboard
                    </Button>
                    <Typography variant="h4" fontWeight={700}>User Management</Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateOpen(true)}
                    sx={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', width: { xs: '100%', sm: 'auto' } }}
                >
                    Add New User
                </Button>
            </Box>

            <TableContainer component={Paper} sx={{ borderRadius: 4, overflowX: { xs: 'hidden', sm: 'auto' } }}>
                <Table sx={{ tableLayout: { xs: 'fixed', sm: 'auto' } }}>
                    <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                        <TableRow>
                            <TableCell sx={{ width: { xs: 60, sm: 'auto' }, px: { xs: 1, sm: 2 } }}><strong>Avatar</strong></TableCell>
                            <TableCell sx={{ px: { xs: 1, sm: 2 } }}><strong>Name</strong></TableCell>
                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}><strong>Email</strong></TableCell>
                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}><strong>Joined Date</strong></TableCell>
                            <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}><strong>Performance</strong></TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}><strong>Role</strong></TableCell>
                            <TableCell align="right" sx={{ width: { xs: 80, sm: 'auto' }, px: { xs: 1, sm: 2 } }}><strong>Actions</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id} hover>
                                <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                                    <Avatar
                                        src={user.photoURL}
                                        alt={user.displayName}
                                        onClick={() => handleAvatarClick(user)}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        {user.displayName?.charAt(0)}
                                    </Avatar>
                                </TableCell>
                                <TableCell sx={{ px: { xs: 1, sm: 2 } }}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Typography variant="body2" noWrap sx={{ maxWidth: { xs: 120, sm: 'auto' } }}>
                                            {user.displayName || 'N/A'}
                                        </Typography>
                                        {user.role === 'team-leader' && (
                                            <Tooltip title="Team Leader">
                                                <AdminIcon color="primary" fontSize="small" />
                                            </Tooltip>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{user.email}</TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                    {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : '-'}
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                                    <Rating value={user.performance?.rating || 0} readOnly size="small" />
                                </TableCell>
                                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                    <Chip
                                        label={user.role || 'editor'}
                                        color={user.role === 'team-leader' ? 'secondary' : 'default'}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell align="right" sx={{ px: { xs: 1, sm: 2 } }}>
                                    <Tooltip title="Edit User">
                                        <IconButton onClick={() => handleEditClick(user)} color="primary">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete User">
                                        <IconButton
                                            onClick={() => handleDeleteClick(user)}
                                            color="error"
                                            disabled={user.email === 'vivek@mm.com'}
                                            size="small"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* User Details Dialog */}
            <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
                <DialogTitle>User Details</DialogTitle>
                <DialogContent>
                    {selectedUser && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
                            <Avatar src={selectedUser.photoURL} sx={{ width: 100, height: 100 }} />
                            <Typography variant="h6">{selectedUser.displayName}</Typography>
                            <Chip label={selectedUser.role} color="primary" variant="outlined" />

                            <Box sx={{ width: '100%', mt: 2 }}>
                                <Typography variant="subtitle2" color="text.secondary">Email</Typography>
                                <Typography variant="body1" gutterBottom>{selectedUser.email}</Typography>

                                <Typography variant="subtitle2" color="text.secondary" mt={1}>Joined Date</Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedUser.createdAt?.toDate ? selectedUser.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                </Typography>

                                <Typography variant="subtitle2" color="text.secondary" mt={1}>Performance</Typography>
                                <Rating value={selectedUser.performance?.rating || 0} readOnly />
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ pb: { xs: 2, sm: 1 } }}>
                    <Button onClick={() => setDetailsOpen(false)}>Close</Button>
                    <Button onClick={() => { setDetailsOpen(false); handleEditClick(selectedUser); }} variant="contained">Edit</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
                <DialogTitle>Edit User</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField label="Display Name" fullWidth value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} />
                        <TextField
                            label="Paste BBCode"
                            value={bbCode}
                            onChange={(e) => {
                                const val = e.target.value;
                                setBbCode(val);
                                const match = val.match(/\[img\](.*?)\[\/img\]/);
                                if (match && match[1]) {
                                    setFormData(prev => ({ ...prev, photoURL: match[1] }));
                                }
                            }}
                            helperText="Paste full BBCode to auto-extract URL"
                            fullWidth
                        />
                        <TextField label="Image URL" fullWidth value={formData.photoURL} onChange={(e) => setFormData({ ...formData, photoURL: e.target.value })} />
                        <FormControl fullWidth>
                            <InputLabel>Role</InputLabel>
                            <Select
                                value={formData.role}
                                label="Role"
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                disabled={currentUser?.email === 'vivek@mm.com'}
                            >
                                <MenuItem value="editor">Editor</MenuItem>
                                <MenuItem value="team-leader">Team Leader</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ pb: { xs: 2, sm: 1 } }}><Button onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={handleSave} variant="contained">Save</Button></DialogActions>
            </Dialog>

            {/* Create User Dialog */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth fullScreen={isMobile}>
                <DialogTitle>Create New User</DialogTitle>
                <DialogContent>
                    <CreateUser
                        onSuccess={() => { setCreateOpen(false); fetchUsers(); }}
                        onCancel={() => setCreateOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete user <strong>{currentUser?.displayName}</strong>? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ pb: { xs: 2, sm: 1 } }}>
                    <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default UserManagement;