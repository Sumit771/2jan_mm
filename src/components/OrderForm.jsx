import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, query, onSnapshot, where } from 'firebase/firestore';
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
    useTheme,
    useMediaQuery
} from '@mui/material';
import { styled } from '@mui/material/styles';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { toast } from 'react-toastify';

/* -------------------- STYLES -------------------- */

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

/* -------------------- COMPONENT -------------------- */

const OrderForm = ({ onOrderCreated }) => {
    const { role } = useAuth();
    const [editors, setEditors] = useState([]);
    const [bbCode, setBbCode] = useState('');
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [form, setForm] = useState({
        name: '',
        telecaller: '',
        remark: '',
        priority: 'normal',
        imageType: 'upload',
        sampleImageUrl: '',
        assignedEditorEmails: [],
        assignedEditorNames: [],
    });

    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);

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

        if (role !== 'team-leader') {
            toast.error('Only team leader can create orders');
            return;
        }

        if (form.assignedEditorEmails.length === 0) {
            toast.error('Please assign at least one editor');
            return;
        }

        setLoading(true);

        try {
            let imageUrl = form.sampleImageUrl;

            if (form.imageType === 'upload' && file) {
                const storageRef = ref(storage, `samples/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                imageUrl = await getDownloadURL(storageRef);
            }

            await addDoc(collection(db, 'orders'), {
                name: form.name,
                telecaller: form.telecaller,
                remark: form.remark,
                priority: form.priority,
                imageType: form.imageType,
                sampleImageUrl: imageUrl,

                assignedEditorEmails: form.assignedEditorEmails,
                assignedEditorNames: form.assignedEditorNames,
                assignmentType: form.assignedEditorEmails.length > 1 ? 'broadcast' : 'direct',
                acceptedAt: null,

                status: 'pending',
                createdAt: serverTimestamp(),
                completedAt: null,
            });

            toast.success('Order created successfully');
            onOrderCreated();
        } catch (err) {
            console.error(err);
            toast.error(err.message);
        }

        setLoading(false);
    };

    return (
        <Box sx={{ width: { xs: '100%', md: '76vw' }, mx: 'auto' }}>
            <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 4 }}>
                <Typography variant="h4" fontWeight={700} mb={4}>
                    Create New Order
                </Typography>

                <Box component="form" onSubmit={handleSubmit}>
                    <Grid container spacing={3}>
                        {/* LEFT */}
                        <Grid item xs={12} md={6}>
                            <GradientTextField
                                fullWidth
                                label="Client Name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                            />

                            <GradientTextField
                                fullWidth
                                label="Telecaller"
                                name="telecaller"
                                value={form.telecaller}
                                onChange={handleChange}
                                sx={{ mt: 3 }}
                                required
                            />

                            <GradientTextField
                                fullWidth
                                label="Remark"
                                name="remark"
                                value={form.remark}
                                onChange={handleChange}
                                sx={{ mt: 3 }}
                                multiline
                                rows={3}
                            />

                            <FormControl fullWidth sx={{ mt: 3 }}>
                                <InputLabel>Priority</InputLabel>
                                <Select
                                    name="priority"
                                    value={form.priority}
                                    label="Priority"
                                    onChange={handleChange}
                                >
                                    <MenuItem value="normal">Normal</MenuItem>
                                    <MenuItem value="high">High</MenuItem>
                                    <MenuItem value="urgent">Urgent</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* RIGHT */}
                        <Grid item xs={12} md={6}>
                            <Typography fontWeight={600} mb={1}>
                                Sample Image
                            </Typography>

                            <RadioGroup
                                row={!isMobile}
                                name="imageType"
                                value={form.imageType}
                                onChange={handleChange}
                            >
                                <FormControlLabel value="upload" control={<Radio />} label="Upload" />
                                <FormControlLabel
                                    value="url"
                                    control={<Radio />}
                                    label={
                                        <Typography>
                                            URL
                                            <Link href="https://imgbb.com/" target="_blank" sx={{ ml: 0.5 }}>
                                                (host here)
                                            </Link>
                                        </Typography>
                                    }
                                />
                            </RadioGroup>

                            {form.imageType === 'upload' ? (
                                <Button
                                    component="label"
                                    variant="outlined"
                                    startIcon={<UploadFileIcon />}
                                    fullWidth
                                    sx={{ mt: 2 }}
                                >
                                    Upload Image
                                    <VisuallyHiddenInput
                                        type="file"
                                        onChange={(e) => setFile(e.target.files[0])}
                                    />
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
                                    <GradientTextField
                                        fullWidth
                                        label="Image URL"
                                        name="sampleImageUrl"
                                        value={form.sampleImageUrl}
                                        onChange={handleChange}
                                        sx={{ mt: 2 }}
                                    />
                                </>
                            )}

                            {/* ASSIGN EDITOR */}
                            <FormControl fullWidth sx={{ mt: 3 }}>
                                <InputLabel>Assign Editor</InputLabel>
                                <Select
                                    label="Assign Editor"
                                    value={
                                        editors.length > 0 && form.assignedEditorEmails.length === editors.length
                                            ? 'all'
                                            : form.assignedEditorEmails[0] || ''
                                    }
                                    onChange={(e) => {
                                        if (e.target.value === 'all') {
                                            setForm({
                                                ...form,
                                                assignedEditorEmails: editors.map(ed => ed.email),
                                                assignedEditorNames: editors.map(ed => ed.name),
                                            });
                                        } else {
                                            const ed = editors.find(i => i.email === e.target.value);
                                            setForm({
                                                ...form,
                                                assignedEditorEmails: [ed.email],
                                                assignedEditorNames: [ed.name],
                                            });
                                        }
                                    }}
                                >
                                    <MenuItem value="" disabled>Select Editor</MenuItem>
                                    <MenuItem value="all">All Editors</MenuItem>
                                    {editors.map((e) => (
                                        <MenuItem key={e.email} value={e.email}>
                                            {e.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>

                    {/* ACTIONS */}
                    <Box display="flex" justifyContent="flex-end" gap={2} mt={5} sx={{ flexDirection: { xs: 'column', sm: 'row' } }}>
                        <Button variant="outlined" onClick={onOrderCreated}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            sx={{
                                px: 4,
                                color: '#fff',
                                background: 'linear-gradient(135deg,#667eea,#764ba2)',
                            }}
                        >
                            {loading ? 'Saving…' : 'Save Order'}
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default OrderForm;
