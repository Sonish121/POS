import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import styles from './style'

// Constants
const API_BASE_URL = 'http://localhost:5000';
const QR_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  PAID: 'paid',
  FAILED: 'failed'
};

function Billing({ username }) {
  // State for item management
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemImage, setCustomItemImage] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [billItems, setBillItems] = useState([]);
  
  // State for payment handling
  const [amountGiven, setAmountGiven] = useState('');
  const [exchange, setExchange] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [qrStatus, setQrStatus] = useState(QR_STATES.IDLE);
  const [qrImageUrl, setQrImageUrl] = useState('');
  
  // State for invoice management
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isLoadingInvoiceNumber, setIsLoadingInvoiceNumber] = useState(true);
  
  // State for image viewer
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  
  // Refs
  const statusCheckIntervalRef = useRef(null);
  const transactionIdRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Initialize component - fetch invoice number and items
  useEffect(() => {
    fetchLastInvoiceNumber();
    fetchItems();
    
    // Cleanup function for intervals when component unmounts
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    };
  }, []);

  // Add ESC key listener for closing image viewer
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showImageViewer) {
        setShowImageViewer(false);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    
    // Cleanup event listener when component unmounts
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [showImageViewer]);

  // Fetch available items from backend
  const fetchItems = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/items`);
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };
  
  // Fetch the last invoice number and generate next one
  const fetchLastInvoiceNumber = async () => {
    setIsLoadingInvoiceNumber(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/last-invoice-number`);
      
      if (response.data && typeof response.data.lastInvoiceNumber !== 'undefined') {
        const lastNumber = parseInt(response.data.lastInvoiceNumber, 10) || 0;
        const newInvoiceNumber = (lastNumber + 1).toString().padStart(5, '0');
        setInvoiceNumber(newInvoiceNumber);
      } else {
        setInvoiceNumber('00001');
      }
    } catch (error) {
      console.error('Error fetching last invoice number:', error);
      setInvoiceNumber('00001'); // Start with '00001' if there's an error
    } finally {
      setIsLoadingInvoiceNumber(false);
    }
  };

  // Calculate the total bill amount
  const calculateTotalAmount = () => {
    return billItems.reduce((total, item) => total + item.total, 0);
  };
  
  const totalAmount = calculateTotalAmount();
  // Add selected item to the bill
  const addItemToBill = () => {
    if ((!selectedItem && !customItemName) || !quantity) {
      alert('Please select or enter an item and enter quantity.');
      return;
    }

    const itemPrice = customItemName ? parseFloat(customItemPrice || '0') : selectedItem.price;
    const itemImage = selectedItem ? selectedItem.imageUrl : null;
    
    const newItem = {
      name: customItemName || selectedItem.name,
      price: itemPrice,
      quantity: parseInt(quantity),
      total: itemPrice * parseInt(quantity),
      imageUrl: itemImage,
    };

    setBillItems([...billItems, newItem]);
    resetItemFields();
  };

  // Reset item input fields
  const resetItemFields = () => {
    setQuantity('');
    setSelectedItem(null);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove an item from the bill
  const removeItem = (itemIndex) => {
    const updatedItems = billItems.filter((_, index) => index !== itemIndex);
    setBillItems(updatedItems);
  };

  // Reset the entire billing form
  const refreshBill = () => {
    // Confirm before refreshing if there are items in the bill
    if (billItems.length > 0) {
      const confirmRefresh = window.confirm("Are you sure you want to clear the current bill and start over?");
      if (!confirmRefresh) return;
    }
    
    // Reset all states to initial values
    setBillItems([]);
    resetItemFields();
    setAmountGiven('');
    setExchange(0);
    setPaymentMethod(null);
    setQrStatus(QR_STATES.IDLE);
    setQrImageUrl('');
    
    // Fetch a new invoice number for the next bill
    fetchLastInvoiceNumber();
    
    // Clear any ongoing interval
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }
    
    transactionIdRef.current = null;
  };

  // Calculate exchange amount for cash payments
  const calculateExchange = () => {
    if (!amountGiven) {
      alert('Please enter the amount given by the customer.');
      return;
    }
    setExchange(parseFloat(amountGiven) - totalAmount);
  };
  
  // Fetch FonePay QR code for online payment
  const fetchFonePayQR = async () => {
    try {
      setQrStatus(QR_STATES.LOADING);
      
      // Generate a unique transaction ID
      const uniqueTransactionId = `ORDER-${Date.now()}`;
      transactionIdRef.current = uniqueTransactionId;
      
      // In a real application, you would make this API call to FonePay
      // For demo purposes, we're simulating the API response
      setTimeout(() => {
        setQrImageUrl('https://placeholder.com/qr-code'); // Placeholder QR image
        setQrStatus(QR_STATES.SUCCESS);
        startPaymentStatusCheck(uniqueTransactionId);
      }, 1500);
      
    } catch (error) {
      console.error('Error fetching QR code:', error);
      setQrStatus(QR_STATES.ERROR);
    }
  };
  
  // Start checking for payment status
  const startPaymentStatusCheck = (transactionId) => {
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
    }
    
    // For demo purposes, we'll simulate a successful payment after 5 seconds
    statusCheckIntervalRef.current = setTimeout(() => {
      setQrStatus(QR_STATES.PAID);
    }, 5000);
  };

  // Save custom item with image to database
  const saveCustomItem = async () => {
    if (!customItemName || !customItemPrice || !customItemImage) {
      alert('Please enter item name, price, and select an image.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', customItemName);
      formData.append('price', customItemPrice);
      formData.append('image', customItemImage);

      const response = await axios.post(`${API_BASE_URL}/add-item`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.status === 201) {
        alert('Item added successfully!');
        fetchItems(); // Refresh the items list
        resetItemFields();
      }
    } catch (error) {
      console.error('Error saving custom item:', error);
      alert('Failed to save item. Please try again.');
    }
  };

  // Generate PDF and save invoice
  const printBill = async () => {
    if (isLoadingInvoiceNumber) {
      alert("Invoice number is still loading. Please wait a moment.");
      return;
    }
    
    if (!invoiceNumber) {
      alert("Invalid invoice number. Please refresh the page and try again.");
      return;
    }
    
    // Prepare invoice data
    const invoiceData = {
      invoiceNumber,
      seller: username,
      date: new Date().toISOString(),
      items: billItems,
      totalAmount,
      paymentMethod,
      transactionId: paymentMethod === "online" ? transactionIdRef.current : null,
      amountGiven: paymentMethod === "cash" ? parseFloat(amountGiven) : null,
      exchange: paymentMethod === "cash" ? exchange : null,
      cashier: username
    };
  
    try {
      // Save invoice to database
      const response = await axios.post(`${API_BASE_URL}/save-invoice`, invoiceData);
  
      if (response.status !== 201) {
        throw new Error("Failed to save invoice to the database.");
      }
  
      // Ask the user if they want to print the invoice
      const userConfirmed = window.confirm("Do you want to print the invoice?");
      
      if (!userConfirmed) {
        refreshBill(); // Reset the form for a new bill
        return; // Stop here if the user doesn't want to print
      }
      
      // Generate PDF document
      generateInvoicePDF(invoiceData);
      
      // After successful printing, reset the form for a new bill
      refreshBill();
      
    } catch (error) {
      console.error("Error saving invoice:", error);
      alert("Failed to save invoice. Please try again.");
    }
  };
  
  // Generate PDF invoice
  const generateInvoicePDF = (invoiceData) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("New Rochak Khadya Udhyog", 50, 10);
    
    // Invoice details
    doc.setFontSize(12);
    doc.text(`Invoice #: ${invoiceNumber}`, 10, 20);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 150, 20);
    doc.text(`Cashier: ${username}`, 10, 25);
    doc.line(10, 30, 200, 30); // Line separator

    // Table Headers
    let yPosition = 40;
    doc.setFont("helvetica", "bold");
    doc.text("S.N.", 10, yPosition);
    doc.text("Item Name", 30, yPosition);
    doc.text("Price", 90, yPosition);
    doc.text("Quantity", 120, yPosition);
    doc.text("Total", 150, yPosition);
    doc.line(10, yPosition + 5, 200, yPosition + 5);

    // Table Content
    doc.setFont("helvetica", "normal");
    yPosition += 15;
    billItems.forEach((item, index) => {
      doc.text(`${index + 1}`, 10, yPosition);
      doc.text(item.name, 30, yPosition);
      doc.text(`Rs. ${item.price}`, 90, yPosition);
      doc.text(`${item.quantity}`, 120, yPosition);
      doc.text(`Rs. ${item.total}`, 150, yPosition);
      yPosition += 10;
    });

    doc.line(10, yPosition, 200, yPosition);
    yPosition += 10;

    // Total Amount & Payment Details
    doc.setFont("helvetica", "bold");
    doc.text(`Total Amount: Rs. ${totalAmount}`, 150, yPosition);
    yPosition += 10;
    
    // Add payment method information
    doc.text(`Payment Method: ${paymentMethod === 'online' ? 'Online Payment' : 'Cash'}`, 150, yPosition);
    yPosition += 10;
    
    if (paymentMethod === 'cash') {
      doc.text(`Amount Given: Rs. ${amountGiven}`, 150, yPosition);
      yPosition += 10;
      doc.text(`Exchange: Rs. ${exchange}`, 150, yPosition);
    } else {
      doc.text(`Transaction ID: ${transactionIdRef.current || 'N/A'}`, 150, yPosition);
    }
    
    // Footer
    yPosition = 270;
    doc.text("Thank you for your business!", 80, yPosition);

    // Save the PDF
    doc.save(`Invoice_${invoiceNumber}.pdf`);
  };
  
  // Handle payment method selection
  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    
    if (method === 'cash') {
      setQrStatus(QR_STATES.IDLE);
      // Clear any existing QR code data
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
    } else if (method === 'online') {
      setExchange(0);
      fetchFonePayQR();
    }
  };
  
  // Handler for numeric inputs to prevent negative values
  const handleNumericInput = (e, setter) => {
    const value = e.target.value;
    // Only set the value if it's empty or a positive number
    if (value === '' || parseFloat(value) >= 0) {
      setter(value);
    }
  };
  
  // Handle double click on image to show in full screen
  const handleImageDoubleClick = (imageUrl) => {
    if (imageUrl) {
      setCurrentImageUrl(imageUrl);
      setShowImageViewer(true);
    }
  };

  // Close the image viewer
  const closeImageViewer = () => {
    setShowImageViewer(false);
    setCurrentImageUrl('');
  };
  
  // Render QR code section based on status
  const renderQrSection = () => {
    switch (qrStatus) {
      case QR_STATES.IDLE:
        return null;
      case QR_STATES.LOADING:
        return <p style={{ textAlign: 'center' }}>Generating QR code...</p>;
      case QR_STATES.SUCCESS:
        return (
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{ 
                width: '200px', 
                height: '200px', 
                backgroundColor: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                border: '1px solid #ddd',
                cursor: 'pointer'
              }}
              onDoubleClick={() => handleImageDoubleClick('https://placeholder.com/qr-code')}
            >
              QR Code Placeholder
            </div>
            <p style={{ fontWeight: 'bold', margin: '10px 0' }}>Scan to pay Rs. {totalAmount}</p>
            <p style={{ color: '#555', fontSize: '14px' }}>Waiting for payment...</p>
          </div>
        );
      case QR_STATES.PAID:
        return (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#27ae60', fontWeight: 'bold', fontSize: '18px' }}>✅ Payment Successful!</p>
            <button 
              onClick={printBill} 
              style={{ ...styles.button, ...styles.purpleButton, marginTop: '15px' }}
            >
              Print Bill (PDF)
            </button>
          </div>
        );
      case QR_STATES.FAILED:
        return <p style={{ color: '#e74c3c', fontWeight: 'bold', textAlign: 'center' }}>❌ Payment Failed. Please try again.</p>;
      case QR_STATES.ERROR:
        return <p style={{ color: '#e74c3c', fontWeight: 'bold', textAlign: 'center' }}>Error generating QR code. Please try again.</p>;
      default:
        return null;
    }
  };

  // Render exchange section for cash payments
  const renderExchangeSection = () => {
    if (!(exchange !== 0 || amountGiven)) return null;
    
    return (
      <div
        style={{
          marginTop: '20px',
          fontSize: '20px',
          fontWeight: 'bold',
          color: exchange < 0 ? '#e74c3c' : '#27ae60',
          textAlign: 'center'
        }}
      >
        {exchange < 0
          ? `Balance Due: Rs. ${Math.abs(exchange)}`
          : exchange > 0
            ? `Exchange: Rs. ${exchange}`
            : `Exchange: Rs. 0 😊`}
      </div>
    );
  };

  // Full-screen image viewer component
  const ImageViewer = () => {
    if (!showImageViewer) return null;
    
    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={closeImageViewer}
      >
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          color: 'white',
          cursor: 'pointer',
          fontSize: '24px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          ✕
        </div>
        
        <img 
          src={currentImageUrl} 
          alt="Enlarged View"
          style={{
            maxWidth: '90%',
            maxHeight: '90%',
            objectFit: 'contain'
          }}
        />
        
        <div style={{
          position: 'absolute',
          bottom: '20px',
          color: 'white',
          fontSize: '14px'
        }}>
          Press ESC to close
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Full-screen Image Viewer */}
      <ImageViewer />

      <div style={styles.header}>
        <h2>Welcome!</h2>    
        <h3>Billing System</h3>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {/* Item Entry Section */}
        <div style={styles.formContainer}>
          <h3 style={{ margin: '0 0 20px 0' }}>Items</h3>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>Select Item or Type Item Name</label>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <select
                value={selectedItem ? selectedItem.id : ''}
                onChange={(e) => {
                  const selected = items.find((item) => item.id.toString() === e.target.value);
                  setSelectedItem(selected);
                  setCustomItemName(''); // Clear custom input when dropdown is used
                }}
                style={{ ...styles.input, marginBottom: '10px' }}
              >
                <option value="">-- Select an Item --</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - Rs. {item.price}
                  </option>
                ))}
              </select>
              
              {/* Preview of selected item image */}
              {selectedItem && selectedItem.imageUrl && (
                <div style={{ marginBottom: '10px' }}>
                  <img 
                    src={selectedItem.imageUrl} 
                    alt={selectedItem.name}
                    style={{ 
                      width: '100px', 
                      height: '100px', 
                      objectFit: 'cover',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    onDoubleClick={() => handleImageDoubleClick(selectedItem.imageUrl)}
                  />
                </div>
              )}
            </div>
            
            {/* Input for Custom Item */}
            <input
              type="text"
              placeholder="Or type a custom item name"
              value={customItemName}
              onChange={(e) => {
                setCustomItemName(e.target.value);
                setSelectedItem(null); // Clear dropdown when custom name is entered
              }}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Price (Rs.)</label>
            <input
              type="number"
              min="0"
              value={customItemName ? customItemPrice : (selectedItem ? selectedItem.price : '')}
              onChange={(e) => handleNumericInput(e, setCustomItemPrice)}
              style={styles.input}
              disabled={selectedItem !== null}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Quantity</label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => handleNumericInput(e, setQuantity)}
              style={styles.input}
            />
          </div>

          <button
            onClick={addItemToBill}
            style={{ ...styles.button, ...styles.primaryButton }}
          >
            Add Item to Bill
          </button>
          
          {customItemName && customItemPrice && customItemImage && (
            <button
              onClick={saveCustomItem}
              style={{ 
                ...styles.button, 
                ...styles.orangeButton, 
                marginTop: '10px' 
              }}
            >
              Save as New Item
            </button>
          )}
        </div>

        {/* Bill Summary Section */}
        <div style={{ width: '600px' }}>
          <div style={styles.titleRow}>
            <h3 style={{ margin: '0' }}>Bill Summary</h3>
            <button
              onClick={refreshBill}
              style={styles.refreshButton}
            >
              🔄 Reset
            </button>
          </div>
          
          <div style={styles.invoiceInfo}>
            <strong>Invoice #:</strong> {isLoadingInvoiceNumber ? "Loading..." : invoiceNumber} | <strong>Cashier:</strong> {username}
          </div>
          
          {billItems.length === 0 ? (
            <div>No items added yet.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Image</th>
                  <th style={styles.th}>Item Name</th>
                  <th style={styles.th}>Price</th>
                  <th style={styles.th}>Quantity</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {billItems.map((item, index) => (
                  <tr key={index}>
                    <td style={styles.td}>
                      {item.imageUrl ? (
                        <img 
                          src={item.imageUrl} 
                          alt={item.name}
                          style={{ 
                            width: '40px', 
                            height: '40px', 
                            objectFit: 'cover',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          onDoubleClick={() => handleImageDoubleClick(item.imageUrl)}
                        />
                      ) : (
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          backgroundColor: '#f0f0f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          color: '#888',
                          borderRadius: '4px'
                        }}>
                          No Image
                        </div>
                      )}
                    </td>
                    <td style={styles.td}>{item.name}</td>
                    <td style={styles.td}>{item.price}</td>
                    <td style={styles.td}>{item.quantity}</td>
                    <td style={styles.td}>{item.total}</td>
                    <td style={styles.td}>
                      <button
                        onClick={() => removeItem(index)}
                        style={styles.deleteButton}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div>
            <div style={styles.highlightAmount}>Total Amount: Rs. {totalAmount}</div>
            
            {/* Payment Method Selection */}
            {billItems.length > 0 && (
              <div style={styles.paymentButtons}>
                <button
                  onClick={() => handlePaymentMethodChange('cash')}
                  style={{
                    ...styles.paymentButton,
                    ...styles.cashButton,
                    ...(paymentMethod === 'cash' ? styles.activeButton : {})
                  }}
                >
                  💰 Cash
                </button>
                
                <button
                  onClick={() => handlePaymentMethodChange('online')}
                  style={{
                    ...styles.paymentButton,
                    ...styles.onlineButton,
                    ...(paymentMethod === 'online' ? styles.activeButton : {})
                  }}
                >
                  🌐 Online 
                </button>
              </div>
            )}
            
            {/* Cash Payment Section */}
            {paymentMethod === 'cash' && (
              <div style={styles.paymentSection}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Amount Given by Customer (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={amountGiven}
                    onChange={(e) => handleNumericInput(e, setAmountGiven)}
                    style={styles.input}
                  />
                </div>
                <button
                  onClick={calculateExchange}
                  style={{ ...styles.button, ...styles.orangeButton, width: '100%' }}
                >
                  Calculate Exchange
                </button>

                {renderExchangeSection()}
                
                {/* Print Button for Cash Payment */}
                {exchange >= 0 && amountGiven && (
                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                      onClick={printBill}
                      style={{ ...styles.button, ...styles.purpleButton }}
                    >
                      Print Bill (PDF)
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Online Payment Section */}
            {paymentMethod === 'online' && (
              <div style={styles.paymentSection}>
                {renderQrSection()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Billing;