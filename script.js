// script.js

let device;
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
    try {
        // Request the USB device
        device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x239A }] // Adafruit Vendor ID
        });

        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);

        isConnected = true;
        updateUIConnected();

        statusDiv.textContent = 'Connected to device.';
        console.log('Connected to device.');

        // Start reading data
        readData();

    } catch (error) {
        statusDiv.textContent = 'Connection failed: ' + error;
        console.error('Connection failed:', error);
    }
});

disconnectButton.addEventListener('click', async () => {
    if (isConnected && device) {
        try {
            await device.close();
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
    if (isConnected && device) {
        try {
            statusDiv.textContent = 'Flashing firmware...';
            console.log('Flashing firmware...');

            // Fetch the UF2 firmware file
            const response = await fetch('sof.uf2');
            const firmwareData = await response.arrayBuffer();

            // Flash the UF2 firmware
            await flashUF2Firmware(new Uint8Array(firmwareData));

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
        const encoder = new TextEncoder();
        const data = encoder.encode(command + '\n');

        // Send data to the device
        await device.transferOut(2, data);

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
            const result = await device.transferIn(1, 64);
            if (result.status === 'ok') {
                const decoder = new TextDecoder();
                const data = decoder.decode(result.data);
                responseDiv.innerText += data;
                responseDiv.scrollTop = responseDiv.scrollHeight;
            }
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

async function flashUF2Firmware(firmwareData) {
    // Send UF2 firmware data via WebUSB
    // The UF2 bootloader accepts commands over USB to receive the firmware
    // Implementing the UF2 protocol involves sending data in 512-byte blocks

    const blockSize = 512;
    const totalBlocks = firmwareData.length / blockSize;

    for (let i = 0; i < firmwareData.length; i += blockSize) {
        const block = firmwareData.slice(i, i + blockSize);

        // Send block to the device
        await device.transferOut(2, block);

        // Optional: Update progress
        const progress = Math.floor((i / firmwareData.length) * 100);
        statusDiv.textContent = `Flashing firmware... (${progress}%)`;
    }
}

