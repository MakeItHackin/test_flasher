// script.js

let port;
let reader;
let writer;
let isConnected = false;

// Get references to UI elements
const connectButton = document.getElementById('connect');
const disconnectButton = document.getElementById('disconnect');
const flashButton = document.getElementById('flash');
const statusDiv = document.getElementById('status');
const responseDiv = document.getElementById('response');
const commandInput = document.getElementById('commandInput');
const sendCommandButton = document.getElementById('sendCommand');

// Command buttons 0-9
const commandButtons = [];
for (let i = 0; i <= 9; i++) {
    commandButtons[i] = document.getElementById(`cmd${i}`);
}

// Event listener for Connect button
connectButton.addEventListener('click', async () => {
    try {
        if ('serial' in navigator) {
            // Request a port and open a connection.
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });

            isConnected = true;
            updateUIConnected();

            statusDiv.textContent = 'Connected to Arduino.';
            console.log('Connected to Arduino.');

            // Setup reader and writer
            writer = port.writable.getWriter();
            reader = port.readable.getReader();

            // Start reading data
            readData();
        } else {
            statusDiv.textContent = 'Web Serial API not supported in this browser.';
            console.error('Web Serial API not supported.');
        }
    } catch (error) {
        statusDiv.textContent = 'Connection failed: ' + error;
        console.error('Connection failed:', error);
    }
});

// Event listener for Disconnect button
disconnectButton.addEventListener('click', async () => {
    if (isConnected && port) {
        try {
            // Close the reader and writer
            await reader.cancel();
            await writer.close();
            await port.close();

            isConnected = false;
            updateUIDisconnected();

            statusDiv.textContent = 'Disconnected from Arduino.';
            console.log('Disconnected from Arduino.');
        } catch (error) {
            statusDiv.textContent = 'Disconnection failed: ' + error;
            console.error('Disconnection failed:', error);
        }
    }
});

// Event listener for Flash Firmware button
flashButton.addEventListener('click', async () => {
    if (isConnected && port) {
        try {
            statusDiv.textContent = 'Flashing firmware...';
            console.log('Flashing firmware...');

            // Fetch the UF2 firmware file
            const response = await fetch('sof.uf2');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const firmwareData = await response.arrayBuffer();

            // Flash the firmware without wrapping
            await flashFirmware(new Uint8Array(firmwareData));

        } catch (error) {
            statusDiv.textContent = 'Flashing failed: ' + error;
            console.error('Flashing failed:', error);
        }
    } else {
        statusDiv.textContent = 'Please connect to the Arduino first.';
    }
});


// Event listener for Send Command button
sendCommandButton.addEventListener('click', async () => {
    const command = commandInput.value.trim();
    if (command && isConnected) {
        await sendSerialCommand(command);
        commandInput.value = '';
    }
});

// Allow sending command with Enter key
commandInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        sendCommandButton.click();
    }
});

// Event listeners for command buttons 0-9
for (let i = 0; i <= 9; i++) {
    commandButtons[i].addEventListener('click', async () => {
        if (isConnected) {
            await sendSerialCommand(i.toString());
        }
    });
}

// Function to send serial commands
async function sendSerialCommand(command) {
    try {
        const data = new TextEncoder().encode(command + '\n'); // Append newline if needed by device
        await writer.write(data);
        statusDiv.textContent = `Sent command: ${command}`;
        console.log(`Sent command: ${command}`);
    } catch (error) {
        statusDiv.textContent = 'Failed to send command: ' + error;
        console.error('Failed to send command:', error);
    }
}

// Function to read data from the device
async function readData() {
    try {
        while (isConnected) {
            const { value, done } = await reader.read();
            if (done) {
                // Allow the serial port to be closed later.
                reader.releaseLock();
                break;
            }
            // value is a Uint8Array.
            const textDecoder = new TextDecoder();
            const data = textDecoder.decode(value);
            responseDiv.innerText += data;
            responseDiv.scrollTop = responseDiv.scrollHeight;
        }
    } catch (error) {
        console.error('Read error:', error);
    }
}

// Function to flash firmware by sending each UF2 block sequentially
async function flashFirmware(firmwareData) {
    try {
        const blockSize = 512; // Each UF2 block is 512 bytes
        const totalBlocks = firmwareData.length / blockSize;

        console.log(`Firmware size: ${firmwareData.length} bytes`);
        console.log(`Total UF2 blocks to flash: ${totalBlocks}`);

        for (let i = 0; i < totalBlocks; i++) {
            const start = i * blockSize;
            const end = start + blockSize;
            const uf2Block = firmwareData.slice(start, end);

            // Optional: Verify the UF2 block integrity
            if (uf2Block.length !== blockSize) {
                throw new Error(`UF2 block ${i + 1} is incomplete. Expected ${blockSize} bytes, got ${uf2Block.length} bytes.`);
            }

            // Send the UF2 block
            await writer.write(uf2Block);
            console.log(`UF2 Block ${i + 1}/${totalBlocks} sent successfully.`);

            // Update flashing progress
            const progress = Math.floor(((i + 1) / totalBlocks) * 100);
            statusDiv.textContent = `Flashing firmware... (${progress}%)`;
        }

        // Final status update
        statusDiv.textContent = 'Firmware flashed successfully!';
        console.log('Firmware flashing completed successfully.');
    } catch (error) {
        throw new Error(`Error during flashing: ${error.message}`);
    }
}


// Function to update UI when connected
function updateUIConnected() {
    connectButton.disabled = true;
    disconnectButton.disabled = false;
    flashButton.disabled = false;
    commandInput.disabled = false;
    sendCommandButton.disabled = false;

    commandButtons.forEach(button => {
        button.disabled = false;
    });
}

// Function to update UI when disconnected
function updateUIDisconnected() {
    connectButton.disabled = false;
    disconnectButton.disabled = true;
    flashButton.disabled = true;
    commandInput.disabled = true;
    sendCommandButton.disabled = true;

    commandButtons.forEach(button => {
        button.disabled = true;
    });
}
