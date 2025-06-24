import React, { useState } from "react";
import Billing from "./Billing"; // Updated import path

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState(""); // Store login errors

  // Multiple valid credentials
  const validCredentials = [
    { username: "sonish", password: "test" },
    { username: "yadu", password: "test" },
    { username: "janaki", password: "test" }
  ];

  // Function to handle login with multiple credentials
  const handleLogin = (e) => {
    e.preventDefault();
    const validUser = validCredentials.find(
      (cred) => cred.username === username && cred.password === password
    );

    if (validUser) {
      setIsLoggedIn(true);
      setErrorMessage(""); // Clear error message on successful login
    } else {
      setErrorMessage("Invalid username or password");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      {isLoggedIn ? (
        <Billing username={username} />
      ) : (
        <div
          style={{
            border: "1px solid #ddd",
            padding: "20px",
            display: "inline-block",
            borderRadius: "10px",
          }}
        >
          <h2>NRKU POS</h2>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Enter Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ padding: "10px", margin: "5px", width: "200px" }}
            />
            <br />
            <input
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: "10px", margin: "5px", width: "200px" }}
            />
            <br />
            {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
            <button
              type="submit"
              style={{
                padding: "10px 20px",
                background: "blue",
                color: "white",
                border: "none",
                borderRadius: "5px",
              }}
            >
              Login
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;