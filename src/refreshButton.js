document.addEventListener("DOMContentLoaded", function() {
    // Create the button
    const button = document.createElement('button');
    button.textContent = 'Refresh';
    button.id = 'refreshButton';
    button.className = 'refresh-btn';

    // Add the button to the body
    document.body.appendChild(button);

    // Style the button
    const style = document.createElement('style');
    style.textContent = `
        body { margin: 0; padding: 0; height: 100vh; }
        .refresh-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        .refresh-btn:hover {
            background-color: #0056b3;
        }
    `;
    document.head.appendChild(style);

    // Add the event listener to the button
    button.addEventListener('click', function() {
        location.reload();
    });
});
export default Refresh;