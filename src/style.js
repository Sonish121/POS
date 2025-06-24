// Styles object moved outside component to reduce re-renders
const styles = {
    container: {
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    },
    header: {
      textAlign: 'center',
      color: '#2c3e50',
      marginBottom: '20px'
    },
    formContainer: {
      display: 'flex',
      flexDirection: 'column',
      padding: '25px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      marginBottom: '30px',
      width: '320px'
    },
    formGroup: {
      marginBottom: '15px'
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      fontSize: '14px',
      fontWeight: '500',
      color: '#555'
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      borderRadius: '6px',
      border: '1px solid #ddd',
      fontSize: '14px',
      boxSizing: 'border-box'
    },
    button: {
      padding: '12px 20px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    },
    primaryButton: {
      backgroundColor: '#2ecc71',
      color: 'white'
    },
    orangeButton: {
      backgroundColor: '#f39c12',
      color: 'white'
    },
    purpleButton: {
      backgroundColor: '#8e44ad',
      color: 'white'
    },
    deleteButton: {
      backgroundColor: '#e74c3c',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '4px',
      border: 'none'
    },
    refreshButton: {
      backgroundColor: '#3498db',
      color: 'white',
      padding: '10px 15px',
      borderRadius: '6px',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      marginLeft: 'auto'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: '25px'
    },
    th: {
      backgroundColor: '#f5f5f5',
      padding: '12px 15px',
      textAlign: 'left',
      borderBottom: '2px solid #ddd'
    },
    td: {
      padding: '10px 15px',
      borderBottom: '1px solid #ddd'
    },
    highlightAmount: {
      backgroundColor: '#f5f5f5',
      padding: '15px',
      textAlign: 'center',
      fontSize: '20px',
      fontWeight: 'bold',
      borderRadius: '6px',
      marginBottom: '20px'
    },
    paymentButtons: {
      display: 'flex',
      justifyContent: 'center',
      gap: '10px',
      marginTop: '20px',
      marginBottom: '20px'
    },
    paymentButton: {
      padding: '12px 24px',
      fontSize: '16px',
      fontWeight: 'bold',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      width: '150px'
    },
    cashButton: {
      backgroundColor: '#f1c40f',  // Yellow color
      color: '#333',  // Dark text for better contrast on yellow
      '&:hover': {
        backgroundColor: '#f39c12'  // Slightly darker yellow on hover
      }
    },
    onlineButton: {
      backgroundColor: '#2ecc71',  // Green color
      color: 'white',
      '&:hover': {
        backgroundColor: '#27ae60'  // Slightly darker green on hover
      }
    },
    activeButton: {
      transform: 'scale(0.95)',
      boxShadow: '0 0 10px rgba(0,0,0,0.2)'
    },
    paymentSection: {
      padding: '15px',
      borderRadius: '6px',
      backgroundColor: '#f9f9f9',
      marginBottom: '20px'
    },
    amountInputContainer: {
      display: 'flex',
      gap: '10px',
      marginBottom: '15px'
    },
    amountInput: {
      flex: '1',
      padding: '12px',
      fontSize: '16px',
      border: '2px solid #e67e22',
      borderRadius: '6px',
      outline: 'none'
    },
    calculateButton: {
      backgroundColor: '#e67e22',
      color: 'white',
      padding: '12px 20px',
      fontSize: '16px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'background-color 0.3s'
    },
    titleRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    invoiceInfo: {
      backgroundColor: '#f5f5f5',
      padding: '10px',
      borderRadius: '6px',
      fontSize: '14px',
      marginBottom: '15px'
    }
  };
  export default styles;