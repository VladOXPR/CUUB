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

    // Demo mode if no battery ID
    if (!batteryId) {
        generateDemoMode();
        return;
    }

    // Set battery ID display
    if (batteryIdDisplay) {
        batteryIdDisplay.textContent = `${batteryId}`;
    }

    // Construct API URL
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const apiUrl = `http://${host}${port}/api/battery/${batteryId}`;

    try {
        // Add loading state
        if (outputDiv) {
            outputDiv.classList.add('loading');
        }

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error("Battery not found");
        }

        const data = await response.json();

        // Remove loading state
        if (outputDiv) {
            outputDiv.classList.remove('loading');
            // Clear existing content
            outputDiv.innerHTML = "";
        }

        // Check if battery has been returned
        if (data.pGhtime) {
            generateReturnedDisplay(data);
        } else {
            generateActiveRentalDisplay(data);
        }

    } catch (error) {
        if (outputDiv) {
            outputDiv.classList.remove('loading');
        }
        showError(error.message);
        console.error("Error fetching battery data:", error.message);
    }
}

window.onload = () => {
    fetchBatteryData();
    setInterval(updateElapsedTime, 1000);
    setInterval(fetchBatteryData, 10000);
};
