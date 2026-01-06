import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
    TextField,
    Button,
    Typography,
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    RadioGroup,
    FormControlLabel,
    Radio,
    Paper,
    Grid,
    Link,
    CircularProgress,
    IconButton
} from '@mui/material';
import { styled } from '@mui/material/styles';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { toast } from 'react-toastify';

const GradientTextField = styled(TextField)(() => ({
    '& label.Mui-focused': { color: '#667eea' },
    '& .MuiOutlinedInput-root': {
        borderRadius: 14,
        '&:hover fieldset': { borderColor: '#764ba2' },
        '&.Mui-focused fieldset': {
            borderWidth: 2,
            borderImage: `linear-gradient(135deg,#667eea,#764ba2) 1`,
        },
    },
}));

const VisuallyHiddenInput = styled('input')({
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    width: 1,
});

const SelfOrderForm = ({ onOrderCreated }) => {
    const { user } = useAuth();
    const [form, setForm] = useState({
        name: '',
        telecaller: '',
        remark: '',
        priority: 'normal',
        imageType: 'upload',
        sampleImageUrl: '',
    });
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [bbCode, setBbCode] = useState('');
    const [darkMode, setDarkMode] = useState(false);

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const handleBbCodeChange = (e) => {
        const val = e.target.value;
        setBbCode(val);
        const match = val.match(/\[img\](.*?)\[\/img\]/);
        if (match && match[1]) {
            setForm((prev) => ({ ...prev, sampleImageUrl: match[1] }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            // Check if editor is approved for self-orders
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            const userData = userDoc.data();
            const isApproved = userData?.selfOrderApproved === true;

            let imageUrl = form.sampleImageUrl;
            if (form.imageType === 'upload' && file) {
                const storageRef = ref(storage, `samples/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                imageUrl = await getDownloadURL(storageRef);
            }

            const editorName = userData?.displayName || user.displayName || user.email.split('@')[0];

            await addDoc(collection(db, 'orders'), {
                name: form.name,
                telecaller: form.telecaller,
                remark: form.remark,
                priority: form.priority,
                imageType: form.imageType,
                sampleImageUrl: imageUrl,

                assignedEditorEmails: [user.email],
                assignedEditorNames: [editorName],
                assignmentType: 'self',
                isSelfOrder: true,

                // If approved, go to pending directly. If not, wait for approval.
                status: isApproved ? 'pending' : 'waiting-approval',

                createdAt: serverTimestamp(),
                acceptedAt: null,
                completedAt: null,
            });

            toast.success(isApproved ? 'Self order created!' : 'Order sent for Team Leader approval.');
            if (onOrderCreated) onOrderCreated();
        } catch (err) {
            console.error(err);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ width: { xs: '93vw', sm: '93vw', md: '75vw' }, mx: 'auto', mt: 4 }}>
            <Paper sx={{
                p: 4,
                borderRadius: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
            }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                    <Typography variant="h4" fontWeight={700}>
                        Create Self Order
                    </Typography>

                </Box>

                <Box component="form" onSubmit={handleSubmit}>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <GradientTextField fullWidth sx={{ width: { xs: '75vw', sm: '400px', md: '400px' } }} label="Client / Order Name" name="name" value={form.name} onChange={handleChange} required />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <GradientTextField fullWidth sx={{ width: { xs: '75vw', sm: '400px', md: '400px' } }} label="Telecaller" name="telecaller" value={form.telecaller} onChange={handleChange} required />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth sx={{ width: { xs: '75vw', sm: '400px', md: '400px' } }}>
                                <InputLabel>Priority</InputLabel>
                                <Select name="priority" value={form.priority} label="Priority" onChange={handleChange}>
                                    <MenuItem value="normal">Normal</MenuItem>
                                    <MenuItem value="high">High</MenuItem>
                                    <MenuItem value="urgent">Urgent</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <GradientTextField sx={{ width: { xs: '75vw', sm: '400px', md: '400px' }, height: '18vh' }} label="Remark" name="remark" value={form.remark} onChange={handleChange} multiline rows={7} />
                        </Grid>
                        {/* 
                        <Grid item >
                            <GradientTextField
                                xs={{ width: '600px' }}
                                label="Remark"
                                name="remark"
                                value={form.remark}
                                onChange={handleChange}
                                multiline

                                minRows={3}
                                maxRows={16}
                            />
                        </Grid> */}

                        <Grid item xs={12} md={6}>
                            <Typography fontWeight={300} mb={1}>Sample Image</Typography>
                            <RadioGroup row name="imageType" value={form.imageType} onChange={handleChange}>
                                <FormControlLabel value="upload" control={<Radio />} label="Upload" />
                                <FormControlLabel value="url" control={<Radio />} label={<Typography>URL <Link href="https://imgbb.com/" target="_blank" sx={{ ml: 0.5 }}>(host here)</Link></Typography>} />
                            </RadioGroup>
                            {form.imageType === 'upload' ? (
                                <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} fullWidth sx={{ mt: 2 }}>
                                    Upload Image
                                    <VisuallyHiddenInput type="file" onChange={(e) => setFile(e.target.files[0])} />
                                </Button>
                            ) : (
                                <>
                                    <GradientTextField
                                        fullWidth
                                        label="Paste BBCode"
                                        value={bbCode}
                                        onChange={handleBbCodeChange}
                                        sx={{ mt: 2 }}
                                        helperText="Paste full BBCode to auto-extract URL"
                                    />
                                    <GradientTextField fullWidth label="Image URL" name="sampleImageUrl" value={form.sampleImageUrl} onChange={handleChange} sx={{ mt: 2 }} />
                                </>
                            )}
                            {file && form.imageType === 'upload' && <Typography variant="caption" display="block" sx={{ mt: 1 }}>Selected: {file.name}</Typography>}
                        </Grid>
                    </Grid>

                    <Box display="flex" justifyContent="flex-end" gap={2} mt={4}>
                        <Button variant="outlined" onClick={onOrderCreated}>Cancel</Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            variant="contained"
                            sx={{
                                px: 4,
                                color: '#fff',
                                background: 'linear-gradient(135deg,#667eea,#764ba2)',
                            }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Order'}
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default SelfOrderForm;