import React, { useState } from 'react';
import {
    Box,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    CircularProgress,
    InputAdornment,
    IconButton,
    Avatar
} from '@mui/material';
import { Visibility, VisibilityOff, UploadFile as UploadFileIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { toast } from 'react-toastify';

const VisuallyHiddenInput = styled('input')({
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    whiteSpace: 'nowrap',
    width: 1,
});

const CreateUser = ({ onSuccess, onCancel }) => {
    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        password: '',
        role: 'editor'
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
            setPreviewUrl(URL.createObjectURL(e.target.files[0]));
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);

        // 1. Get the config from the existing db instance
        const firebaseConfig = db.app.options;

        // 2. Initialize a secondary app to create user without logging out admin
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuth(secondaryApp);

        try {
            // 3. Create User in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(
                secondaryAuth,
                formData.email,
                formData.password
            );
            const newUser = userCredential.user;

            let photoURL = '';
            if (file) {
                const storageRef = ref(storage, `profile_pictures/${newUser.uid}`);
                await uploadBytes(storageRef, file);
                photoURL = await getDownloadURL(storageRef);
                await updateProfile(newUser, { photoURL });
            }

            // 4. Create User Document in Firestore (using main Admin db instance)
            await setDoc(doc(db, 'users', newUser.uid), {
                email: formData.email,
                displayName: formData.displayName,
                role: formData.role,
                photoURL: photoURL,
                status: 'Active',
                performance: {
                    ordersCompleted: 0,
                    rating: 5.0
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // 5. Cleanup
            await signOut(secondaryAuth);
            toast.success(`User ${formData.displayName} created successfully!`);
            if (onSuccess) onSuccess();

        } catch (error) {
            console.error("Error creating user:", error);
            toast.error(error.message);
        } finally {
            await deleteApp(secondaryApp);
            setLoading(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                <Avatar
                    src={previewUrl}
                    sx={{ width: 80, height: 80, bgcolor: 'primary.main' }}
                >
                    {!previewUrl && formData.displayName.charAt(0).toUpperCase()}
                </Avatar>
                <Button
                    component="label"
                    variant="outlined"
                    startIcon={<UploadFileIcon />}
                    size="small"
                >
                    Upload Photo
                    <VisuallyHiddenInput type="file" accept="image/*" onChange={handleFileChange} />
                </Button>
            </Box>
            <TextField
                label="Display Name"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                required
                fullWidth
            />
            <TextField
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                fullWidth
            />
            <TextField
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                required
                fullWidth
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
            />
            <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                    name="role"
                    value={formData.role}
                    label="Role"
                    onChange={handleChange}
                >
                    <MenuItem value="editor">Editor</MenuItem>
                    <MenuItem value="team-leader">Team Leader</MenuItem>
                </Select>
            </FormControl>

            <Box display="flex" justifyContent="flex-end" gap={2} mt={1}>
                <Button onClick={onCancel} disabled={loading}>Cancel</Button>
                <Button type="submit" variant="contained" disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : "Create User"}
                </Button>
            </Box>
        </Box>
    );
};

export default CreateUser;