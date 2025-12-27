import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Chip,
  Fade,
  IconButton
} from '@mui/material';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DownloadIcon from '@mui/icons-material/Download';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import EditIcon from '@mui/icons-material/Edit';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const STATUS_CONFIG = {
  Pending: {
    gradient: 'linear-gradient(135deg, #FBC02D 0%, #F9A825 100%)',
    border: '#FBC02D',
    shadow: '0 4px 20px rgba(251, 192, 45, 0.3)'
  },
  'In-Progress': {
    gradient: 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)',
    border: '#1976D2',
    shadow: '0 4px 20px rgba(25, 118, 210, 0.3)'
  },
  Completed: {
    gradient: 'linear-gradient(135deg, #388E3C 0%, #2E7D32 100%)',
    border: '#388E3C',
    shadow: '0 4px 20px rgba(56, 142, 60, 0.3)'
  }
};

const MonthlyOrders = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { month = new Date().getMonth(), year = new Date().getFullYear() } =
    location.state || {};

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [exporting, setExporting] = useState(false);

  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59);

        const q = query(
          collection(db, 'orders'),
          where('createdAt', '>=', Timestamp.fromDate(start)),
          where('createdAt', '<=', Timestamp.fromDate(end))
        );

        const snap = await getDocs(q);
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [month, year]);

  const filteredOrders = useMemo(() => {
    if (filter === 'All') return orders;
    return orders.filter(o => {
      if (o.status === 'in-progress' && filter === 'In-Progress') return true;
      if (o.status === 'pending' && filter === 'Pending') return true;
      if (o.status === 'completed' && filter === 'Completed') return true;
      return false;
    });
  }, [filter, orders]);

  const statusCounts = useMemo(() => {
    return {
      All: orders.length,
      Pending: orders.filter(o => o.status === 'pending').length,
      'In-Progress': orders.filter(o => o.status === 'in-progress').length,
      Completed: orders.filter(o => o.status === 'completed').length
    };
  }, [orders]);

  const getBase64ImageFromURL = (url) => {
    return new Promise((resolve, reject) => {
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
      img.onerror = error => {
        resolve(null);
      };
      img.src = url;
    });
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      doc.text(`Orders - ${monthName} ${year}`, 14, 15);

      const tableColumn = ["ID", "Image", "Order Name", "Telecaller", "Editor", "Status", "Date"];
      const tableRows = [];
      const rowImages = {};

      const promises = orders.map(async (order) => {
        const imageUrl = order.sampleImageUrl || order.sampleImage || order.imageUrl || order.images?.[0];
        let imgData = null;
        if (imageUrl) {
          imgData = await getBase64ImageFromURL(imageUrl);
        }
        return { ...order, imgData };
      });

      const processedOrders = await Promise.all(promises);

      processedOrders.forEach((order, index) => {
        if (order.imgData) rowImages[index] = order.imgData;
        tableRows.push([
          order.id.substring(0, 8),
          '', // Placeholder for image
          order.name,
          order.telecaller || 'N/A',
          order.assignedEditorNames?.join(', ') || 'N/A',
          order.status,
          new Date(order.createdAt?.seconds * 1000).toLocaleDateString()
        ]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 25,
        rowPageBreak: 'avoid',
        bodyStyles: { valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25, minCellHeight: 25 },
        },
        didDrawCell: (data) => {
          if (data.column.index === 1 && data.cell.section === 'body') {
            const img = rowImages[data.row.index];
            if (img) {
              const padding = 2;
              const dim = data.cell.height - (padding * 2);
              doc.addImage(img, 'JPEG', data.cell.x + padding, data.cell.y + padding, dim, dim);
            }
          }
        }
      });

      doc.save(`Orders_${monthName}_${year}.pdf`);
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const renderStatusIcon = (status) => {
    const statusKey = status === 'in-progress' ? 'In-Progress' : status.charAt(0).toUpperCase() + status.slice(1);
    const config = STATUS_CONFIG[statusKey];
    if (!config) return null;

    if (status === 'completed') return <CheckCircleIcon sx={{ fontSize: 28, color: config.border }} />;
    if (status === 'pending') return <PendingIcon sx={{ fontSize: 28, color: config.border }} />;
    if (status === 'in-progress') return <TrendingUpIcon sx={{ fontSize: 28, color: config.border }} />;

    return null;
  };

  if (loading) {
    return (
      <Box
        sx={{
          height: '100vh',

          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}
      >
        <CircularProgress sx={{ color: '#fff' }} size={60} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '98vw',
        background: 'linear-gradient(135deg, #bdbdbdff 0%, #e7ceffff 100%)',
        pb: 4
      }}
    >
      {/* FIXED HEADER */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          width: '98vw',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}
      >
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
          {/* Title and Export */}
          <Box
            sx={{

              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 2,
              mb: 2
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={() => navigate(-1)} sx={{ color: '#667eea' }}>
                <ArrowBackIcon />
              </IconButton>
              <Box>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  {monthName} {year}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
            </Box>

            <Button
              variant="contained"
              startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              onClick={exportPDF}
              disabled={exporting}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.6)'
                }
              }}
            >
              {exporting ? 'Exporting...' : 'Export PDF'}
            </Button>
          </Box>

          {/* Filter Buttons */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexWrap: 'wrap'
            }}
          >
            {['All', 'Pending', 'In-Progress', 'Completed'].map(status => (
              <Chip
                key={status}
                label={`${status} (${statusCounts[status]})`}
                onClick={() => setFilter(status)}
                sx={{
                  px: 1,
                  height: 36,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  ...(filter === status
                    ? {
                      background:
                        status === 'All'
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : STATUS_CONFIG[status]?.gradient || '#9E9E9E',
                      color: '#fff',
                      boxShadow:
                        status === 'All'
                          ? '0 4px 15px rgba(102, 126, 234, 0.4)'
                          : STATUS_CONFIG[status]?.shadow || 'none'
                    }
                    : {
                      backgroundColor: 'rgba(0,0,0,0.04)',
                      color: 'text.primary',
                      '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.08)'
                      }
                    })
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>

      {/* ORDERS LIST - ONE CARD PER ROW */}
      <Box sx={{ px: { xs: 2, sm: 3 }, mt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredOrders.map((order, idx) => {
            const statusKey = order.status === 'in-progress' ? 'In-Progress' : order.status.charAt(0).toUpperCase() + order.status.slice(1);
            return (
              <Fade in timeout={300 + idx * 50} key={order.id}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    background: '#fff',
                    border: `3px solid ${STATUS_CONFIG[statusKey]?.border || '#B0BEC5'}`,
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: STATUS_CONFIG[statusKey]?.shadow || '0 8px 30px rgba(0,0,0,0.12)'
                    }
                  }}
                >
                  {/* Status Bar */}
                  <Box
                    sx={{
                      height: 6,
                      background: STATUS_CONFIG[statusKey]?.gradient || '#9E9E9E'
                    }}
                  />

                  <Box sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        gap: 3,
                        alignItems: { xs: 'flex-start', md: 'center' }
                      }}
                    >
                      {/* Image */}
                      <Box
                        sx={{
                          position: 'relative',
                          width: { xs: '100%', sm: 120, md: 140 },
                          height: { xs: 200, sm: 120, md: 140 },
                          borderRadius: 2,
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: '2px solid',
                          borderColor: 'divider',
                          cursor: 'pointer',
                          '&:hover .preview': {
                            opacity: 1,
                            transform: 'translate(-50%, -50%) scale(1)'
                          }
                        }}
                      >
                        <img
                          src={
                            order.sampleImageUrl ||
                            order.sampleImage ||
                            order.imageUrl ||
                            order.images?.[0] ||
                            '/placeholder.png'
                          }
                          alt="order"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />

                        {/* Hover Preview */}
                        <Box
                          className="preview"
                          sx={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            width: { xs: 300, sm: 450 },
                            height: { xs: 300, sm: 450 },
                            backgroundColor: '#000',
                            borderRadius: 3,
                            overflow: 'hidden',
                            zIndex: 2000,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                            opacity: 0,
                            transform: 'translate(-50%, -50%) scale(0.9)',
                            transition: 'all 0.2s ease',
                            pointerEvents: 'none',
                            border: `4px solid ${STATUS_CONFIG[statusKey]?.border || '#fff'}`
                          }}
                        >
                          <img
                            src={
                              order.sampleImageUrl ||
                              order.sampleImage ||
                              order.imageUrl ||
                              order.images?.[0] ||
                              '/placeholder.png'
                            }
                            alt="preview"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain'
                            }}
                          />
                        </Box>
                      </Box>

                      {/* Content */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {/* Title, Icon and ID */}
                        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {renderStatusIcon(order.status)}
                          <Box>
                            <Typography
                              variant="h5"
                              sx={{
                                fontWeight: 700,
                                mb: 0.5,
                                wordBreak: 'break-word'
                              }}
                            >
                              {order.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: 'text.secondary',
                                fontFamily: 'monospace',
                                fontSize: '0.85rem'
                              }}
                            >
                              Order ID: #{order.id}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Details Grid */}
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                            gap: 2,
                            mb: 2
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(118, 75, 162, 0.1)'
                              }}
                            >
                              <PhoneIcon sx={{ fontSize: 20, color: '#764ba2' }} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Telecaller
                              </Typography>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {order.telecaller || 'N/A'}
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(25, 118, 210, 0.1)'
                              }}
                            >
                              <EditIcon sx={{ fontSize: 20, color: '#1976D2' }} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Editor
                              </Typography>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {order.assignedEditorNames?.join(', ') || 'Unassigned'}
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(56, 142, 60, 0.1)'
                              }}
                            >
                              <CalendarTodayIcon sx={{ fontSize: 18, color: '#388E3C' }} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Created
                              </Typography>
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {new Date(order.createdAt?.seconds * 1000).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        {/* Status Badge */}
                        <Box>
                          <Chip
                            label={order.status}
                            sx={{
                              background: STATUS_CONFIG[statusKey]?.gradient || '#050d03ff',
                              color: '#ffffffff',
                              fontWeight: 700,
                              fontSize: '0.875rem',
                              height: 32,
                              px: 2
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </Fade>)
          })}
        </Box>

        {filteredOrders.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              background: '#fff',
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}
          >
            <Typography sx={{ fontSize: 80 }}>🤷</Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No orders found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your filters
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default MonthlyOrders;