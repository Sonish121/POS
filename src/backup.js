//date=april12
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import styles from './style'
// Import custom font to support Devanagari script (Nepali)
import "jspdf-autotable";
import { fontLoader } from 'jspdf';
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
    const itemName = customItemName || selectedItem.name;
    const quantityToAdd = parseInt(quantity);
    
    // Check if item already exists in the bill
    const existingItemIndex = billItems.findIndex(item => item.name === itemName);
    
    if (existingItemIndex !== -1) {
      // Update existing item
      const updatedBillItems = [...billItems];
      const existingItem = updatedBillItems[existingItemIndex];
      
      existingItem.quantity += quantityToAdd;
      existingItem.total = existingItem.price * existingItem.quantity;
      
      setBillItems(updatedBillItems);
    } else {
      // Add new item
      const newItem = {
        name: itemName,
        price: itemPrice,
        quantity: quantityToAdd,
        total: itemPrice * quantityToAdd,
        imageUrl: itemImage,
      };
      
      setBillItems([...billItems, newItem]);
    }
    
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
    const exchangeAmount = parseFloat(amountGiven) - totalAmount;
    setExchange(exchangeAmount);
    
    // Show feedback message
    if (exchangeAmount === 0) {
      alert('Amount is exact! No change needed.');
    } else if (exchangeAmount < 0) {
      alert('Amount given is less than the total amount!');
    }
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
    const pageHeight = doc.internal.pageSize.height;

    const pageWidth = doc.internal.pageSize.width;
    const centerX = pageWidth / 2;

    // Store Info - Centered with larger title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text("New Rochak Khadya Udhyog", centerX, 20, { align: "center" });
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Bharatpur-7,Chitwan", centerX, 30, { align: "center" });
    
    // Mobile, PAN, and ESTIMATE labels in bold, values in normal - all centered
    doc.setFont("Helvetica", "bold");
    doc.text("Mobile:", centerX - 20, 35);
    doc.setFont("Helvetica", "normal");
    doc.text("9845068407", centerX + 15, 35);
    
    doc.setFont("Helvetica", "bold");
    doc.text("PAN:", centerX - 15, 40);
    doc.setFont("Helvetica", "normal");
    doc.text("605233483", centerX + 10, 40);
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Estimate", centerX, 48, { align: "center" });

    // Invoice Details - Left aligned
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Date:", 20, 55);
    doc.text("Invoice No:", 20, 60);
    doc.text("Cashier:", 20, 65);
    
    doc.setFont("Helvetica", "normal");
    doc.text(new Date().toLocaleDateString(), 60, 55);
    doc.text(invoiceNumber, 60, 60);
    doc.text(username, 60, 65);

    // Table Headers
    let yPosition = 75;
    doc.setFont("Helvetica", "bold");
    doc.text("#", 20, yPosition);
    doc.text("Product", 30, yPosition);
    doc.text("Qty", 90, yPosition);
    doc.text("Unit Price", 110, yPosition);
    doc.text("Subtotal", 150, yPosition);
    
    // Draw line under headers
    doc.line(20, yPosition + 2, 190, yPosition + 2);

    // Table Content
    doc.setFont("Helvetica", "normal");
    yPosition += 10;
    billItems.forEach((item, index) => {
      doc.text(`${index + 1}`, 20, yPosition);
      doc.text(item.name, 30, yPosition);
      doc.text(`${item.quantity}`, 90, yPosition);
      doc.text(`Rs. ${item.price.toFixed(2)}`, 110, yPosition);
      doc.text(`Rs. ${item.total.toFixed(2)}`, 150, yPosition);
      yPosition += 8;
    });

    // Draw line after items
    yPosition += 5;
    doc.line(20, yPosition, 190, yPosition);
    yPosition += 10;

    // Totals
    doc.setFont("Helvetica", "bold");
    doc.text("Subtotal:", 110, yPosition);
    doc.text(`Rs. ${totalAmount.toFixed(2)}`, 150, yPosition);
    yPosition += 8;


    // Payment info
    doc.setFont("Helvetica", "normal");
    if (paymentMethod === 'cash') {
      doc.text(`Cash (${new Date().toLocaleDateString()})`, 20, yPosition);
      doc.text(`Rs. ${amountGiven}`, 110, yPosition);
      yPosition += 8;
      doc.text("Total Paid:", 20, yPosition);
      doc.text(`Rs. ${amountGiven}`, 110, yPosition);
      yPosition += 8;
      doc.text("Change:", 20, yPosition);
      doc.text(`Rs. ${exchange.toFixed(2)}`, 110, yPosition);
    } else {
      doc.text(`Online Payment (${new Date().toLocaleDateString()})`, 20, yPosition);
      doc.text(`Rs. ${totalAmount.toFixed(2)}`, 110, yPosition);
      yPosition += 8;
      doc.text("Transaction ID:", 20, yPosition);
      doc.text(transactionIdRef.current || 'N/A', 110, yPosition);
    }

    // Notes
    yPosition += 20;
    doc.text("This invoice is only for internal use.", 20, yPosition);

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
            <label style={styles.label}>Unit Price (Rs.)</label>
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
                  <th style={styles.th}>Unit Price</th>
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

                {/* Show exchange information */}
                {amountGiven && (
                  <div style={{
                    padding: '10px',
                    marginTop: '10px',
                    backgroundColor: exchange === 0 ? '#e8f5e9' : exchange > 0 ? '#fff3e0' : '#ffebee',
                    borderRadius: '4px',
                    textAlign: 'center'
                  }}>
                    {exchange === 0 ? (
                      <div style={{ color: '#2e7d32' }}>✓ Amount is exact</div>
                    ) : exchange > 0 ? (
                      <div style={{ color: '#f57c00' }}>Change to return: Rs. {exchange.toFixed(2)}</div>
                    ) : (
                      <div style={{ color: '#c62828' }}>Amount is insufficient</div>
                    )}
                  </div>
                )}
                
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