const { DateTime } = luxon;
let borrowTime = null;

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
    return `$${(Math.ceil(DateTime.now().diff(startTime, 'hours').hours) * 3).toFixed(2)}`;
}

function updateElapsedTime() {
    if (borrowTime) {
        document.getElementById("elapsedTime").textContent = getTimeElapsed(borrowTime);
        document.getElementById("amountPaid").textContent = calculateAmountPaid(borrowTime);
    }
}

async function fetchBatteryData() {
    const batteryId = window.location.pathname.substring(1);
    const outputDiv = document.getElementById("output");
    const batteryIdDisplay = document.getElementById("batteryIdDisplay");

    if (!batteryId) {
        outputDiv.innerHTML = "<p><strong>No Battery ID provided in URL.</strong></p>";
        batteryIdDisplay.textContent = "";
        return;
    }

    batteryIdDisplay.textContent = `${batteryId}`;
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const apiUrl = `https://${host}${port}/api/battery/${batteryId}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Battery not found.");

        const data = await response.json();
        outputDiv.innerHTML = "";

        if (data.pGhtime) {
            const chiReturnTime = convertChinaToChicagoTime(data.pGhtime);
            outputDiv.innerHTML = `<p><strong>Battery Returned:</strong> ${chiReturnTime ? chiReturnTime.toFormat("yyyy-MM-dd HH:mm:ss") : "Invalid Return Time"}</p>`;
        } else {
            borrowTime = convertChinaToChicagoTime(data.pBorrowtime);
            if (borrowTime) {
                outputDiv.innerHTML = `
                    <p><strong></strong> <span id="elapsedTime">${getTimeElapsed(borrowTime)}</span></p>
                    <p><strong></strong> <span id="amountPaid">${calculateAmountPaid(borrowTime)}</span></p>
                `;
            } else {
                outputDiv.innerHTML = `<p><strong>Invalid Borrow Time</strong></p>`;
            }
        }
    } catch (error) {
        outputDiv.innerHTML = `<p>Error: ${error.message}</p>`;
        console.error("Error:", error.message);
    }
}

window.onload = () => {
    fetchBatteryData();
    setInterval(updateElapsedTime, 1000);
    setInterval(fetchBatteryData, 10000);
};
