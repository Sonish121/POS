//backup date :2025-06-26
//backup file : Billing.js
//comment all the code and add comments to the code   


import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import styles from './style'
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
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
  
  // State for today's sales
  const [todaySales, setTodaySales] = useState({ transactions: [], aggregatedItems: [], summary: {} });
  const [showTodaySales, setShowTodaySales] = useState(false);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  
  // Refs
  const statusCheckIntervalRef = useRef(null);
  const transactionIdRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // New item state
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  
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

  // Fetch today's sales
  const fetchTodaySales = async () => {
    setIsLoadingSales(true);
    try {
      const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
      const response = await axios.get(`${API_BASE_URL}/today-sales?date=${today}`);
      setTodaySales(response.data);
      setShowTodaySales(true);
    } catch (error) {
      console.error('Error fetching today\'s sales:', error);
      alert('Failed to fetch today\'s sales. Please try again.');
    } finally {
      setIsLoadingSales(false);
    }
  };

  // Calculate the total bill amount
  const calculateTotalAmount = () => {
    return billItems.reduce((total, item) => total + item.total, 0);
  };
  
  const totalAmount = calculateTotalAmount();
  // Add selected item to the bill
  const addItemToBill = () => {
    if ((!selectedItem && !newItemName) || !quantity) {
      alert('Please select or type an item and enter quantity.');
      return;
    }

    let itemToAdd = selectedItem;

    if (!selectedItem && newItemName) {
      if (!newItemPrice) {
        alert('Please enter a price for the new item.');
        return;
      }
      // Just create a new item object, do not save to DB
      itemToAdd = {
        id: undefined,
        name: newItemName,
        price: parseFloat(newItemPrice),
        imageUrl: null
      };
    }

    const itemPrice = itemToAdd.price;
    const itemImage = itemToAdd.imageUrl;
    const itemName = itemToAdd.name;
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
    setNewItemName('');
    setNewItemPrice('');
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

  // Handle payment completion and save invoice
  const handlePaymentComplete = async () => {
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
      
      // Generate and print PDF
      generateInvoicePDF(invoiceData);
      
      // Reset the form for a new bill
      refreshBill();
      
    } catch (error) {
      console.error("Error saving invoice:", error);
      alert("Failed to save invoice. Please try again.");
    }
  };

  // Calculate exchange amount for cash payments
  const calculateExchange = () => {
    if (!amountGiven) {
      alert('Please enter the amount given by the customer.');
      return;
    }
    const exchangeAmount = parseFloat(amountGiven) - totalAmount;
    setExchange(exchangeAmount);
    
    // If exchange is valid, automatically save the invoice
    if (exchangeAmount >= 0) {
      handlePaymentComplete();
    } else {
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
      handlePaymentComplete(); // Automatically save invoice when online payment is complete
    }, 5000);
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
      // Generate PDF document
      const pdfBlob = generateInvoicePDF(invoiceData);
      
      // Create form data to send both invoice data and PDF
      const formData = new FormData();
      formData.append('invoice', JSON.stringify(invoiceData));
      formData.append('pdf', pdfBlob, `invoice_${invoiceData.invoiceNumber}.pdf`);
      
      // Save invoice and PDF to database
      const response = await axios.post(`${API_BASE_URL}/save-invoice`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
  
      if (response.status !== 201) {
        throw new Error("Failed to save invoice to the database.");
      }
  
      // Backend will handle the printing after saving invoice
      refreshBill(); // Reset the form for a new bill
      
    } catch (error) {
      console.error("Error saving invoice:", error);
      alert("Failed to save invoice. Please try again.");
    }
  };
  
  // Generate PDF invoice and open print dialog
  const generateInvoicePDF = (invoiceData) => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const centerX = pageWidth / 2;
    let yPosition = 20;

    // Header - Company Info
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.text("New Rochak Khadya Udhyog", centerX, yPosition, { align: "center" });
    
    yPosition += 10;
    doc.setFontSize(12);
    doc.text("Bharatpur-7, Chitwan", centerX, yPosition, { align: "center" });
    
    // Contact Info
    yPosition += 8;
    doc.setFontSize(10);
    doc.text("Mobile: 9845068407", centerX, yPosition, { align: "center" });
    yPosition += 6;
    doc.text("PAN: 605233483", centerX, yPosition, { align: "center" });
    
    // Bill Title
    yPosition += 10;
    doc.setFontSize(16);
    doc.text("INVOICE", centerX, yPosition, { align: "center" });

    // Invoice Details Box
    yPosition += 15;
    doc.setFontSize(10);
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, yPosition - 5, pageWidth - 30, 25);

    // Left side details
    doc.setFont("Helvetica", "bold");
    doc.text("Invoice No:", 20, yPosition);
    doc.text("Date:", 20, yPosition + 8);
    
    // Right side details
    doc.text("Cashier:", pageWidth - 80, yPosition);
    doc.text("Payment:", pageWidth - 80, yPosition + 8);

    // Values in normal font
    doc.setFont("Helvetica", "normal");
    doc.text(invoiceNumber, 60, yPosition);
    doc.text(new Date().toLocaleString(), 60, yPosition + 8);
    doc.text(username, pageWidth - 40, yPosition);
    doc.text(paymentMethod.toUpperCase(), pageWidth - 40, yPosition + 8);

    // Items Table
    yPosition += 25;
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPosition - 5, pageWidth - 30, 10, 'F');
    
    // Table Headers
    doc.setFont("Helvetica", "bold");
    doc.text("#", 20, yPosition);
    doc.text("Item Description", 35, yPosition);
    doc.text("Qty", 120, yPosition);
    doc.text("Rate", 140, yPosition);
    doc.text("Amount", 170, yPosition);

    // Table Content
    yPosition += 10;
    doc.setFont("Helvetica", "normal");
    
    billItems.forEach((item, index) => {
      // Add new page if needed
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      doc.text(`${index + 1}`, 20, yPosition);
      doc.text(item.name, 35, yPosition);
      doc.text(item.quantity.toString(), 120, yPosition);
      doc.text(`Rs. ${item.price.toFixed(2)}`, 140, yPosition);
      doc.text(`Rs. ${item.total.toFixed(2)}`, 170, yPosition);
      yPosition += 8;
    });

    // Summary Box
    yPosition += 5;
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, yPosition - 5, pageWidth - 30, 40);

    // Payment Summary
    doc.setFont("Helvetica", "bold");
    doc.text("Total Amount:", 120, yPosition);
    doc.text(`Rs. ${totalAmount.toFixed(2)}`, 170, yPosition);
    yPosition += 8;

    if (paymentMethod === 'cash') {
      const givenAmount = parseFloat(amountGiven);
      const changeAmount = givenAmount - totalAmount;
      
      doc.text("Amount Given:", 120, yPosition);
      doc.text(`Rs. ${givenAmount.toFixed(2)}`, 170, yPosition);
      yPosition += 8;
      doc.text("Change:", 120, yPosition);
      doc.text(`Rs. ${Math.max(0, changeAmount).toFixed(2)}`, 170, yPosition);
    } else {
      doc.text("Transaction ID:", 120, yPosition);
      doc.setFont("Helvetica", "normal");
      doc.text(transactionIdRef.current || 'N/A', 170, yPosition);
    }

    // Footer
    yPosition += 20;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Thank you for your business!", centerX, yPosition, { align: "center" });

    // Save PDF to send to backend
    return doc.output('blob');
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
          padding: '10px',
          marginTop: '10px',
          backgroundColor: exchange === 0 ? '#e8f5e9' : exchange > 0 ? '#fff3e0' : '#ffebee',
          borderRadius: '4px',
          textAlign: 'center'
        }}
      >
        {exchange === 0 ? (
          <div style={{ color: '#2e7d32' }}>✓ Amount is exact</div>
        ) : exchange > 0 ? (
          <div style={{ color: '#f57c00' }}>Change to return: Rs. {exchange.toFixed(2)}</div>
        ) : (
          <div style={{ color: '#c62828' }}>Amount is insufficient</div>
        )}
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
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...styles.label, fontSize: '16px', marginBottom: '8px' }}>Select or Type Item</label>
                <CreatableSelect
                  options={items.map(item => ({ value: item, label: `${item.name} - Rs. ${item.price}` }))}
                  value={selectedItem ? { value: selectedItem, label: `${selectedItem.name} - Rs. ${selectedItem.price}` } : (newItemName ? { value: { name: newItemName, price: newItemPrice }, label: `${newItemName}${newItemPrice ? ` - Rs. ${newItemPrice}` : ''}` } : null)}
                  onChange={option => {
                    if (option && option.__isNew__) {
                      setSelectedItem(null);
                      setNewItemName(option.label);
                      setNewItemPrice('');
                    } else if (option) {
                      setSelectedItem(option.value);
                      setNewItemName('');
                      setNewItemPrice('');
                    } else {
                      setSelectedItem(null);
                      setNewItemName('');
                      setNewItemPrice('');
                    }
                  }}
                  onInputChange={inputValue => {
                    if (!items.some(item => item.name.toLowerCase() === inputValue.toLowerCase())) {
                      setNewItemName(inputValue);
                    } else {
                      setNewItemName('');
                    }
                  }}
                  placeholder="Select or type"
                  isClearable
                  styles={{
                    container: base => ({ ...base, width: '100%' }),
                    control: base => ({ ...base, ...styles.input, minHeight: '48px', height: '48px', fontSize: '18px', width: '100%' }),
                    valueContainer: base => ({ ...base, height: '48px', padding: '0 12px' }),
                    input: base => ({ ...base, fontSize: '18px' }),
                    menu: base => ({ ...base, zIndex: 9999 })
                  }}
                  formatCreateLabel={inputValue => `Add new item: "${inputValue}"`}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...styles.label, fontSize: '16px', marginBottom: '8px' }}>Price (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  value={selectedItem ? selectedItem.price : newItemPrice}
                  onChange={e => {
                    if (!selectedItem) setNewItemPrice(e.target.value);
                  }}
                  style={{ ...styles.input, width: '100%', height: '48px', fontSize: '18px' }}
                  readOnly={!!selectedItem}
                  disabled={!selectedItem && !newItemName}
                  placeholder="Price (Rs.)"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ ...styles.label, fontSize: '16px', marginBottom: '8px' }}>Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => handleNumericInput(e, setQuantity)}
                  style={{ ...styles.input, width: '100%', height: '48px', fontSize: '18px' }}
                  placeholder="Quantity"
                />
              </div>
            </div>
          </div>

          <button
            onClick={addItemToBill}
            style={{ ...styles.button, ...styles.primaryButton }}
          >
            Add Item to Bill
          </button>
        </div>

        {/* Bill Summary Section */}
        <div style={{ width: '600px' }}>
          <div style={styles.titleRow}>
            <h3 style={{ margin: '0' }}>Bill Summary</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={fetchTodaySales}
                disabled={isLoadingSales}
                style={{
                  ...styles.refreshButton,
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: isLoadingSales ? 'not-allowed' : 'pointer',
                  opacity: isLoadingSales ? 0.6 : 1
                }}
              >
                {isLoadingSales ? '⏳ Loading...' : '📊 Total Sales'}
              </button>
              <button
                onClick={refreshBill}
                style={styles.refreshButton}
              >
                🔄 Reset
              </button>
            </div>
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
                            border: '1px solid #ddd',
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
                  onClick={() => setPaymentMethod('cash')}
                  style={{
                    ...styles.paymentButton,
                    ...styles.cashButton,
                    ...(paymentMethod === 'cash' ? styles.activeButton : {})
                  }}
                >
                  💰 Cash
                </button>
                
                <button
                  onClick={() => setPaymentMethod('online')}
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
                <div style={styles.amountInputContainer}>
                  <input
                    type="number"
                    value={amountGiven}
                    onChange={(e) => setAmountGiven(e.target.value)}
                    placeholder="Amount Given"
                    style={styles.amountInput}
                  />
                  <button
                    onClick={calculateExchange}
                    style={styles.calculateButton}
                  >
                    Calculate Change 💱
                  </button>
                </div>
                
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

      {/* Today's Sales Modal */}
      {showTodaySales && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '2px solid #4CAF50',
              paddingBottom: '10px'
            }}>
              <h2 style={{ margin: 0, color: '#4CAF50' }}>📊 Today's Sales Report</h2>
              <button
                onClick={() => setShowTodaySales(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ✕
              </button>
            </div>

            {todaySales.transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📭</div>
                <h3>No sales found for today</h3>
                <p>There are no transactions recorded for today's date.</p>
              </div>
            ) : (
              <div>
                <div style={{
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '6px',
                  marginBottom: '20px',
                  border: '1px solid #e9ecef'
                }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Summary</h3>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
                        {todaySales.transactions.length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>Total Transactions</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
                        Rs. {todaySales.summary.totalRevenue.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>Total Revenue</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FF9800' }}>
                        {todaySales.summary.totalItems}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>Total Items Sold</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9C27B0' }}>
                        Rs. {(todaySales.summary.totalRevenue / todaySales.summary.totalTransactions).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6c757d' }}>Average Sale</div>
                    </div>
                  </div>
                </div>

                <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                  {/* Aggregated Items Section */}
                  <div style={{
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      backgroundColor: '#2196F3',
                      color: 'white',
                      padding: '12px 15px',
                      fontWeight: 'bold',
                      fontSize: '16px'
                    }}>
                      📊 Consolidated Items Sold Today
                    </div>
                    
                    <div style={{ padding: '0' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '14px'
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Item Name</th>
                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Total Qty</th>
                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Unit Price</th>
                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Transactions</th>
                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6' }}>Total Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {todaySales.aggregatedItems.map((item, itemIndex) => (
                            <tr key={itemIndex} style={{
                              backgroundColor: itemIndex % 2 === 0 ? '#ffffff' : '#f8f9fa',
                              borderBottom: '1px solid #dee2e6'
                            }}>
                              <td style={{ padding: '12px', fontWeight: '500', color: '#495057' }}>
                                {item.name}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', color: '#6c757d', fontWeight: 'bold' }}>
                                {item.quantity}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', color: '#6c757d' }}>
                                Rs. {item.price.toFixed(2)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  backgroundColor: '#e3f2fd',
                                  color: '#1976d2'
                                }}>
                                  {item.transactions}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#4CAF50' }}>
                                Rs. {item.total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Transaction Details Section */}
                  <div style={{
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      backgroundColor: '#FF9800',
                      color: 'white',
                      padding: '12px 15px',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      const detailsSection = document.getElementById('transaction-details');
                      if (detailsSection) {
                        detailsSection.style.display = detailsSection.style.display === 'none' ? 'block' : 'none';
                      }
                    }}>
                      📋 Transaction Details (Click to toggle)
                    </div>
                    
                    <div id="transaction-details" style={{ display: 'none' }}>
                      {todaySales.transactions.map((sale, saleIndex) => (
                        <div key={saleIndex} style={{
                          borderBottom: '1px solid #dee2e6',
                          padding: '10px 15px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                Invoice #{sale.invoiceNumber}
                              </span>
                              <span style={{ fontSize: '12px', color: '#6c757d' }}>
                                {new Date(sale.date).toLocaleTimeString()}
                              </span>
                              <span style={{ fontSize: '12px', color: '#6c757d' }}>
                                Cashier: {sale.seller}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                backgroundColor: sale.paymentMethod === 'cash' ? '#e8f5e9' : '#e3f2fd',
                                color: sale.paymentMethod === 'cash' ? '#2e7d32' : '#1976d2'
                              }}>
                                {sale.paymentMethod.toUpperCase()}
                              </span>
                              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#4CAF50' }}>
                                Rs. {sale.totalAmount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          
                          <div style={{ fontSize: '12px', color: '#6c757d' }}>
                            Items: {sale.items.map(item => `${item.name} (${item.quantity})`).join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && <ImageViewer />}
    </div>
  );
}

export default Billing;