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

            // Flash the firmware (enhanced to handle padding and logging)
            await flashFirmware(new Uint8Array(firmwareData));

            statusDiv.textContent = 'Firmware flashed successfully!';
            console.log('Firmware flashed successfully!');
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

// Function to flash firmware with enhanced error handling and padding
async function flashFirmware(firmwareData) {
    try {
        const blockSize = 512; // Each UF2 block is 512 bytes
        const dataPerBlock = blockSize - 32; // 32 bytes reserved for headers
        const dataSize = firmwareData.length;
        const totalBlocks = Math.ceil(dataSize / dataPerBlock);

        console.log(`Firmware size: ${dataSize} bytes`);
        console.log(`Total blocks to flash: ${totalBlocks}`);

        for (let i = 0; i < totalBlocks; i++) {
            const start = i * dataPerBlock;
            let end = start + dataPerBlock;
            if (end > dataSize) {
                end = dataSize;
            }
            let blockData = firmwareData.slice(start, end);

            // Pad the last block with zeros if necessary
            if (blockData.length < dataPerBlock) {
                const padding = new Uint8Array(dataPerBlock - blockData.length);
                blockData = new Uint8Array([...blockData, ...padding]);
                console.log(`Block ${i + 1}: Padded with ${padding.length} bytes`);
            } else {
                console.log(`Block ${i + 1}: Full block`);
            }

            // Create UF2 block
            const uf2Block = createUF2Block(blockData, i, totalBlocks);

            // Send UF2 block
            await writer.write(uf2Block);
            console.log(`Block ${i + 1} sent`);

            // Optional: Update progress
            const progress = Math.floor(((i + 1) / totalBlocks) * 100);
            statusDiv.textContent = `Flashing firmware... (${progress}%)`;
            console.log(`Flashing firmware... (${progress}%)`);
        }
    } catch (error) {
        throw new Error(`Error during flashing: ${error.message}`);
    }
}

// Function to create a UF2 block
function createUF2Block(data, blockNumber, totalBlocks) {
    const uf2 = new Uint8Array(512);

    // Magic start words
    uf2.set(new Uint8Array([0x55, 0x46, 0x32, 0x0A]), 0); // 'UF2\n'
    uf2.set(new Uint8Array([0x57, 0x51, 0x5D, 0x9E]), 4); // Magic Start1

    // Flags (0x0 for no flags)
    uf2[8] = 0x00;
    uf2[9] = 0x00;
    uf2[10] = 0x00;
    uf2[11] = 0x00;

    // Target address (0x00002000 example, replace if necessary)
    const targetAddress = 0x00002000;
    uf2.set(new Uint8Array([
        targetAddress & 0xFF,
        (targetAddress >> 8) & 0xFF,
        (targetAddress >> 16) & 0xFF,
        (targetAddress >> 24) & 0xFF
    ]), 12);

    // Payload size (480 bytes)
    uf2[16] = 0xE0; // 480 in little endian (0x01E0)
    uf2[17] = 0x01;
    uf2[18] = 0x00;
    uf2[19] = 0x00;

    // Family ID (0xADA5BEEF example, replace if necessary)
    uf2.set(new Uint8Array([0xEF, 0xBE, 0xA5, 0xAD]), 20);

    // Block number
    uf2.set(new Uint8Array([
        blockNumber & 0xFF,
        (blockNumber >> 8) & 0xFF,
        (blockNumber >> 16) & 0xFF,
        (blockNumber >> 24) & 0xFF
    ]), 24);

    // Total number of blocks
    uf2.set(new Uint8Array([
        totalBlocks & 0xFF,
        (totalBlocks >> 8) & 0xFF,
        (totalBlocks >> 16) & 0xFF,
        (totalBlocks >> 24) & 0xFF
    ]), 28);

    // Set data
    uf2.set(data, 32);

    // Magic end word
    uf2.set(new Uint8Array([0x30, 0x6F, 0xB1, 0x0A]), 496);

    // Verify UF2 block size
    if (uf2.length !== 512) {
        console.error(`UF2 block size incorrect: ${uf2.length} bytes`);
    }

    return uf2;
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
