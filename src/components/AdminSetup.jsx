import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Button, Box, Typography, Paper, Container, CircularProgress, Alert } from '@mui/material';
import { toast } from 'react-toastify';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

const AdminSetup = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const createTeamLeaderProfile = async () => {
        if (!user) {
            toast.error("You must be logged in to perform this action.");
            return;
        }

        setLoading(true);
        try {
            // This creates the 'users' collection if it doesn't exist
            // and adds the current user as a team-leader
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                role: 'team-leader',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            toast.success("Success! You are now set as a Team Leader.");
        } catch (error) {
            console.error("Setup failed:", error);
            toast.error("Setup failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 10 }}>
            <Paper elevation={3} sx={{ p: 4, textAlign: 'center', borderRadius: 4 }}>
                <AdminPanelSettingsIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h4" gutterBottom fontWeight="bold">
                    Admin Setup
                </Typography>
                <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                    Clicking the button below will create your user profile in Firestore and grant you <strong>Team Leader</strong> privileges.
                </Alert>

                <Button
                    variant="contained"
                    size="large"
                    onClick={createTeamLeaderProfile}
                    disabled={loading || !user}
                    fullWidth
                    sx={{ py: 1.5 }}
                >
                    {loading ? <CircularProgress size={24} color="inherit" /> : "Grant Team Leader Access"}
                </Button>
            </Paper>
        </Container>
    );
};

export default AdminSetup;