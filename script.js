// script.js

let port;
let reader;
let writer;
let isConnected = false;

const connectButton = document.getElementById('connect');
const disconnectButton = document.getElementById('disconnect');
const flashButton = document.getElementById('flash');
const statusDiv = document.getElementById('status');
const responseDiv = document.getElementById('response');
const commandInput = document.getElementById('commandInput');
const sendCommandButton = document.getElementById('sendCommand');

const commandButtons = [];
for (let i = 0; i <= 9; i++) {
    commandButtons[i] = document.getElementById(`cmd${i}`);
}

connectButton.addEventListener('click', async () => {
    if ('serial' in navigator) {
        try {
            // Request a port and open a connection
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });

            isConnected = true;
            updateUIConnected();

            // Setup reader and writer
            writer = port.writable.getWriter();
            reader = port.readable.getReader();

            statusDiv.textContent = 'Connected to device.';
            console.log('Connected to device.');

            // Start reading data
            readData();

        } catch (error) {
            statusDiv.textContent = 'Connection failed: ' + error;
            console.error('Connection failed:', error);
        }
    } else {
        statusDiv.textContent = 'Web Serial API not supported in this browser.';
        console.error('Web Serial API not supported.');
    }
});

disconnectButton.addEventListener('click', async () => {
    if (isConnected) {
        try {
            // Close the reader and writer
            await reader.cancel();
            reader.releaseLock();
            writer.releaseLock();

            await port.close();
            isConnected = false;
            updateUIDisconnected();

            statusDiv.textContent = 'Disconnected.';
            console.log('Disconnected.');
        } catch (error) {
            statusDiv.textContent = 'Disconnection failed: ' + error;
            console.error('Disconnection failed:', error);
        }
    }
});

flashButton.addEventListener('click', async () => {
    if (isConnected) {
        try {
            statusDiv.textContent = 'Flashing firmware...';
            console.log('Flashing firmware...');

            // Fetch the firmware file
            const response = await fetch('sof.hex');
            const firmwareData = await response.arrayBuffer();

            // Flash the firmware (simplified example)
            await flashFirmware(new Uint8Array(firmwareData));

            statusDiv.textContent = 'Firmware flashed successfully!';
            console.log('Firmware flashed successfully!');
        } catch (error) {
            statusDiv.textContent = 'Flashing failed: ' + error;
            console.error('Flashing failed:', error);
        }
    } else {
        statusDiv.textContent = 'Please connect to the device first.';
    }
});

sendCommandButton.addEventListener('click', async () => {
    const command = commandInput.value;
    if (command && isConnected) {
        await sendSerialCommand(command);
        commandInput.value = '';
    }
});

commandInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        sendCommandButton.click();
    }
});

// Add event listeners for command buttons
for (let i = 0; i <= 9; i++) {
    commandButtons[i].addEventListener('click', async () => {
        if (isConnected) {
            await sendSerialCommand(i.toString());
        }
    });
}

async function sendSerialCommand(command) {
    try {
        const data = new TextEncoder().encode(command + '\n');
        await writer.write(data);
        statusDiv.textContent = `Sent command: ${command}`;
        console.log(`Sent command: ${command}`);
    } catch (error) {
        statusDiv.textContent = 'Failed to send command: ' + error;
        console.error('Failed to send command:', error);
    }
}

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

function updateUIConnected() {
    disconnectButton.disabled = false;
    flashButton.disabled = false;
    commandInput.disabled = false;
    sendCommandButton.disabled = false;
    connectButton.disabled = true;

    commandButtons.forEach(button => {
        button.disabled = false;
    });
}

function updateUIDisconnected() {
    disconnectButton.disabled = true;
    flashButton.disabled = true;
    commandInput.disabled = true;
    sendCommandButton.disabled = true;
    connectButton.disabled = false;

    commandButtons.forEach(button => {
        button.disabled = true;
    });
}

async function flashFirmware(firmwareData) {
    // Implement the BOSSA protocol to flash the SAMD21 firmware
    // Note: This is a simplified placeholder
    // Implementing BOSSA protocol over Web Serial requires handling
    // the SAM-BA bootloader commands, which is complex
    // For demonstration purposes, we'll simulate flashing

    // Reset the device to bootloader mode
    await sendResetToBootloader();

    // Wait for the device to re-enumerate
    await delay(2000);

    // Reconnect to the bootloader serial port
    await port.close();
    await delay(1000);
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    writer = port.writable.getWriter();
    reader = port.readable.getReader();

    // Implement the BOSSA protocol here
    // This requires sending specific commands and handling responses

    // For now, we'll simulate a delay
    await delay(5000);

    // After flashing, reset the device back to normal mode
    await sendResetToApplication();

    // Close and reopen the connection
    await port.close();
    await delay(1000);
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    writer = port.writable.getWriter();
    reader = port.readable.getReader();
}

async function sendResetToBootloader() {
    // For SAMD21, setting the baud rate to 1200 triggers the bootloader
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    await port.close();
    await delay(100);
    await port.open({ baudRate: 1200 });
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
    await port.close();
    await delay(1000);
}

async function sendResetToApplication() {
    // Reset the device to application mode
    await port.setSignals({ dataTerminalReady: false, requestToSend: false });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
