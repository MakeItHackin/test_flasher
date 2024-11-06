
// script.js

let port;
let writer;
let reader;
let isConnected = false;

const connectButton = document.getElementById('connect');
const flashButton = document.getElementById('flash');
const statusDiv = document.getElementById('status');

connectButton.addEventListener('click', async () => {
    if ('serial' in navigator) {
        try {
            // Request a port and open a connection.
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });

            isConnected = true;
            flashButton.disabled = false;
            statusDiv.textContent = 'Connected to Arduino. Ready to flash.';
            console.log('Connected to Arduino.');

            // Setup reader and writer
            writer = port.writable.getWriter();
            reader = port.readable.getReader();

        } catch (error) {
            statusDiv.textContent = 'Connection failed: ' + error;
            console.error('Connection failed:', error);
        }
    } else {
        statusDiv.textContent = 'Web Serial API not supported in this browser.';
        console.error('Web Serial API not supported.');
    }
});

flashButton.addEventListener('click', async () => {
    if (isConnected) {
        try {
            statusDiv.textContent = 'Flashing firmware...';
            console.log('Flashing firmware...');

            // Fetch the firmware file
            const response = await fetch('bootloadertest.hex');
            const hexData = await response.text();

            // Parse the hex file and prepare data for flashing
            const firmwareData = parseIntelHex(hexData);

            // Flash the firmware
            await flashFirmware(firmwareData);

            statusDiv.textContent = 'Firmware flashed successfully!';
            console.log('Firmware flashed successfully!');

            // Close the port
            await port.close();
            isConnected = false;
            flashButton.disabled = true;
            connectButton.textContent = 'Connect to Arduino';

        } catch (error) {
            statusDiv.textContent = 'Flashing failed: ' + error;
            console.error('Flashing failed:', error);
        }
    } else {
        statusDiv.textContent = 'Please connect to the Arduino first.';
    }
});

function parseIntelHex(hexString) {
    // Implement a basic parser for Intel HEX format
    // This function converts the hex file content into binary data
    // For simplicity, this example assumes a direct binary transfer
    // In practice, you'll need a proper parser for the hex file format
    const lines = hexString.trim().split('\n');
    let binaryData = [];

    lines.forEach(line => {
        if (line[0] !== ':') return;
        const byteCount = parseInt(line.substr(1, 2), 16);
        const recordType = parseInt(line.substr(7, 2), 16);

        if (recordType === 0) { // Data record
            for (let i = 0; i < byteCount; i++) {
                const byteStr = line.substr(9 + i * 2, 2);
                const byte = parseInt(byteStr, 16);
                binaryData.push(byte);
            }
        }
    });

    return new Uint8Array(binaryData);
}

async function flashFirmware(firmwareData) {
    // Implement the flashing protocol
    // Note: Arduino boards typically require a special flashing protocol
    // such as STK500, AVR109, or similar, which involves handshaking,
    // commands, and checksums. This example is simplified.

    // For demonstration purposes, we'll write the firmware data directly
    // to the serial port, but in practice, you'll need to implement
    // the specific bootloader protocol used by your Arduino.

    // Send firmware data in chunks
    const chunkSize = 64; // Adjust as needed
    for (let i = 0; i < firmwareData.length; i += chunkSize) {
        const chunk = firmwareData.slice(i, i + chunkSize);
        await writer.write(chunk);
        await delay(50); // Small delay between chunks
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
