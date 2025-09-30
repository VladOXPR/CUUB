const { DateTime } = luxon;
let borrowTime = null;
let eventSource = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function convertChinaToChicagoTime(chinaTimeStr) {
    return chinaTimeStr ? DateTime.fromISO(chinaTimeStr, { zone: "Asia/Shanghai" }).setZone("America/Chicago") : null;
}

function getTimeElapsed(startTime) {
    if (!startTime) return "Invalid Time";
    const diff = DateTime.now().setZone("America/Chicago").diff(startTime, ['hours', 'minutes', 'seconds']);
    return `${diff.hours}:${diff.minutes}:${Math.floor(diff.seconds)}`;
}

function calculateAmountPaid(startTime) {
    if (!startTime) return "$0.00";
    const hoursElapsed = DateTime.now().diff(startTime, 'hours').hours;
    let amount = 0;

    if (hoursElapsed <= 168) {
        const days = Math.ceil(hoursElapsed / 24);
        amount = days * 3;
    } else {
        amount = 21;
    }

    return `$${amount.toFixed(2)}`;
}

function updateElapsedTime() {
    if (borrowTime) {
        document.getElementById("elapsedTime").textContent = getTimeElapsed(borrowTime);
        document.getElementById("amountPaid").textContent = calculateAmountPaid(borrowTime);
    }
}

async function initializeBatteryData() {
    const batteryId = window.location.pathname.substring(1);
    currentBatteryId = batteryId;
    const outputDiv = document.getElementById("output");

    if (!batteryId) {
        const randomMinutes = Math.floor(Math.random() * 60) + 1;
        borrowTime = DateTime.now().minus({ minutes: randomMinutes });

        outputDiv.innerHTML = `
            <div id="elapsedTimeContainer">
                <p style="
                    margin: 0px;
                    font-size: 25px;
                    font-weight: bold;
                    color: #CCCCCC;
                ">
                    Rent Duration
                </p>
                <p id="elapsedTime">${getTimeElapsed(borrowTime)}</p>
            </div>

            <div class="containers-wrapper">
                <div id="amountPaidContainer">
                    <p style="
                        margin: 0px;
                        font-size: 20px;
                        font-family: Arial, sans-serif;
                        font-weight: bold;
                        font-style: normal;
                        color: #CCCCCC;
                        width: fit-content;
                    ">
                        Paid
                    </p>
                    <p id="amountPaid" style="font-family: Arial, sans-serif; font-weight: bold; font-size: 50px;">$3.00</p>
                </div>

                <div id="newContainer" onclick="window.open('https://join.sizl.com/download?gad_source=1&gad_campaignid=22219313015&gbraid=0AAAAAq09m4SKH1GEmpDrN-jVrpvEI0e-C&gclid=Cj0KCQjwpf7CBhCfARIsANIETVpv5sYTNK_JWvoYSKHzHIN21adMO_Wlc2TRaJzJirNyfWokgVHsSVcaAlicEALw_wcB&fbp=fb.1.1751129709957.223715049220526725', '_blank');" style="
                    border: 1px solid #009FFF;
                    padding: 12px 15px;
                    border-radius: 20px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 100px;
                    box-sizing: border-box;
                    transition: background-color 0.3s ease;
                ">
                    <img src="sizl-logo.webp" alt="Sizl Logo" style="width: 30px; height: 30px; margin-bottom: 8px;">
                    <div style="
                        font-size: 13px;
                        font-family: 'TT Hoves Pro Trial', Arial, sans-serif;
                        color: #FFFFFF;
                        margin-top: 10px;
                        line-height: 1.3;
                        text-align: center;
                    ">
                        Download and Register the Sizl app to get money back
                    </div>
                </div>
            </div>
        `;
        showRentalStatus();
        return;
    }

    // Load initial battery data
    await fetchInitialBatteryData(batteryId);

    // Set up real-time updates via Server-Sent Events
    setupEventStream(batteryId);
}

async function fetchInitialBatteryData(batteryId) {
    const outputDiv = document.getElementById("output");
    const batteryIdDisplay = document.getElementById("batteryIdDisplay");

    batteryIdDisplay.textContent = `${batteryId}`;
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const apiUrl = `${protocol}//${host}${port}/api/battery/${batteryId}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Battery not found.");

        const data = await response.json();
        processBatteryData(data);
    } catch (error) {
        outputDiv.innerHTML = `<p>Error: ${error.message}</p>`;
        console.error("Error:", error.message);
    }
}

function setupEventStream(batteryId) {
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const eventUrl = `${protocol}//${host}${port}/api/battery/${batteryId}/events`;

    if (eventSource) {
        eventSource.close();
    }

    eventSource = new EventSource(eventUrl);

    eventSource.onopen = function() {
        console.log('Connected to battery status updates');
        reconnectAttempts = 0;
    };

    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'connected') {
                console.log('SSE connection established for battery:', data.batteryId);
            } else if (data.type === 'battery-update') {
                console.log('Battery status update received:', data);
                handleBatteryUpdate(data);
            }
        } catch (error) {
            console.error('Error parsing SSE data:', error);
        }
    };

    eventSource.onerror = function(error) {
        console.error('SSE connection error:', error);
        eventSource.close();

        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
            setTimeout(() => setupEventStream(batteryId), 5000 * reconnectAttempts);
        }
    };
}

function processBatteryData(data) {
    const outputDiv = document.getElementById("output");

    if (data.pGhtime) {
        const chiReturnTime = convertChinaToChicagoTime(data.pGhtime);
        outputDiv.innerHTML = `<p><strong>Battery Returned:</strong> ${chiReturnTime ? chiReturnTime.toFormat("yyyy-MM-dd HH:mm:ss") : "Invalid Return Time"}</p>`;
    } else {
        borrowTime = convertChinaToChicagoTime(data.pBorrowtime);
        if (borrowTime) {
            outputDiv.innerHTML = `
                <div id="elapsedTimeContainer">
                    <p style="
                        margin: 0px;
                        font-size: 25px;
                        font-weight: bold;
                        color: #CCCCCC;
                    ">
                        Rent Duration
                    </p>
                    <p id="elapsedTime">${getTimeElapsed(borrowTime)}</p>
                </div>

                <div class="containers-wrapper">
                    <div id="amountPaidContainer">
                        <p style="
                            margin: 0px;
                            font-size: 20px;
                            font-family: Arial, sans-serif;
                            font-weight: bold;
                            font-style: normal;
                            color: #CCCCCC;
                            width: fit-content;
                        ">
                            Paid
                        </p>
                        <p id="amountPaid">${calculateAmountPaid(borrowTime)}</p>
                    </div>

                    <div id="newContainer" onclick="handleSizlClick()" style="
                        border: 1px solid #009FFF;
                        padding: 12px 15px;
                        border-radius: 20px;
                        cursor: pointer;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        width: 100px;
                        box-sizing: border-box;
                        transition: background-color 0.3s ease;
                    ">
                        <img src="sizl-logo.webp" alt="Sizl Logo" style="width: 30px; height: 30px; margin-bottom: 8px;">
                        <div style="
                            font-size: 13px;
                            font-family: 'TT Hoves Pro Trial', Arial, sans-serif;
                            color: #FFFFFF;
                            margin-top: 10px;
                            line-height: 1.3;
                            text-align: center;
                        ">
                            Download and Register the Sizl app to get money back
                        </div>
                    </div>
                </div>
            `;
            showRentalStatus();
        } else {
            outputDiv.innerHTML = `<p><strong>Invalid Borrow Time</strong></p>`;
        }
    }
}

function handleBatteryUpdate(updateData) {
    console.log('Processing battery update:', updateData);

    // Handle different types of updates
    if (updateData.event === 'returned') {
        const returnTime = convertChinaToChicagoTime(updateData.timestamp);
        const outputDiv = document.getElementById("output");
        outputDiv.innerHTML = `<p><strong>Battery Returned:</strong> ${returnTime ? returnTime.toFormat("yyyy-MM-dd HH:mm:ss") : "Invalid Return Time"}</p>`;
        borrowTime = null;
    } else if (updateData.event === 'borrowed') {
        borrowTime = convertChinaToChicagoTime(updateData.timestamp);
        // Refresh the display with updated borrow time
        processBatteryData({ pBorrowtime: updateData.timestamp });
    }
}

// Legacy function kept for compatibility
async function fetchBatteryData() {
    // This function is now called only for initial load
    // Real-time updates are handled by SSE
    if (!borrowTime) {
        await fetchInitialBatteryData(currentBatteryId);
    }
}

window.onload = () => {
    initializeBatteryData();
    setInterval(updateElapsedTime, 1000);
    // Removed the original setInterval(fetchBatteryData, 10000);
};