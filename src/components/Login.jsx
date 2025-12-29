// src/components/Login.jsx
import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Typography, Box, Checkbox, FormControlLabel, Container } from '@mui/material';
import { styled } from '@mui/material/styles';
import { toast } from 'react-toastify';

const GradientTextField = styled(TextField)(({ theme }) => ({
    '& label.Mui-focused': {
        color: '#667eea', // Focused label color
    },
    '& .MuiOutlinedInput-root': {
        transition: theme.transitions.create(['border-color']),
        '&:hover fieldset': {
            borderColor: '#764ba2', // Hover border color
        },
        '&.Mui-focused fieldset': {
            borderWidth: '2px',
            // Apply gradient as border image
            borderImage: `linear-gradient(135deg, #667eea, #764ba2) 1`,
        },
    },
    // Override browser autofill styles
    '& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active': {
        WebkitBoxShadow: `0 0 0 100px ${theme.palette.background.paper} inset !important`,
        WebkitTextFillColor: `${theme.palette.text.primary} !important`,
        caretColor: 'inherit', // Ensures cursor color is correct
        transition: 'background-color 5000s ease-in-out 0s', // A common trick to prevent the browser from overriding the background
    },
}));


const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const rememberedEmail = localStorage.getItem('rememberedEmail');
        if (rememberedEmail) {
            setEmail(rememberedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistenceType);
            await signInWithEmailAndPassword(auth, email, password);
            if (rememberMe) {
                // Note: Storing passwords in local storage is not recommended for security reasons.
                // We are only storing the email here for convenience.
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }
            toast.success('Logged in successfully');
            navigate('/dashboard');
        } catch (error) {
            toast.error('Login failed: ' + error.message);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                minWidth: '100vw',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
        >
            <Container component="main" maxWidth="sm">
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.75)',
                        backdropFilter: 'blur(10px)',
                        padding: { xs: 2, sm: 4 },
                        borderRadius: 2,
                        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                    }}
                >
                    <Typography component="h1" variant="h5">
                        Sign In
                    </Typography>
                    <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
                        <GradientTextField
                            margin="normal"
                            required
                            fullWidth
                            id="email"
                            label="Email Address"
                            name="email"
                            autoComplete="email"
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <GradientTextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Password"
                            type="password"
                            id="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <FormControlLabel
                            control={<Checkbox value="remember" color="primary" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />}
                            label="Remember me"
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{
                                mt: 3,
                                mb: 2,
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                transition: 'opacity 0.3s ease',
                                '&:hover': {
                                    opacity: 0.9,
                                }
                            }}
                        >
                            Sign In
                        </Button>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
};

export default Login;