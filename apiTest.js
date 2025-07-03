const { DateTime, Duration } = require('luxon');

var myHeaders = new Headers();
myHeaders.append("Authorization", "Basic VmxhZFZhbGNoa292OlZWMTIxMg==");
myHeaders.append("Content-Type", "application/json");
var requestOptions = {
    method: 'GET',
    headers: myHeaders,
    credentials: 'include',
    redirect: 'follow'
};

function convertChinaToChicagoTime(chinaTimeStr) {
    if (!chinaTimeStr) return "Invalid Time";

    const chinaTime = DateTime.fromISO(chinaTimeStr, { zone: "Asia/Shanghai" });
    const chicagoTime = chinaTime.setZone("America/Chicago");

    return chicagoTime.isValid ? chicagoTime : null;
}

function getTimeElapsed(startTime) {
    if (!startTime) return "Invalid Time";

    const now = DateTime.now().setZone("America/Chicago");
    const diff = now.diff(startTime, ['hours', 'minutes', 'seconds']);

    return `${diff.hours}h ${diff.minutes}m ${diff.seconds.toFixed(0)}s`;
}

fetch("https://developer.chargenow.top/cdb-open-api/v1/order/list?page=1&limit=100", requestOptions)
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        if (!result.page || !result.page.records) {
            throw new Error("Invalid API response structure");
        }

        const matchingRecord = result.page.records.find(record => record.pBatteryid === "FECB075E50");

        if (matchingRecord) {
            const chiBorrowtime = convertChinaToChicagoTime(matchingRecord.pBorrowtime);
            if (chiBorrowtime) {
                console.log("Battery Borrowed:", chiBorrowtime.toFormat("yyyy-MM-dd HH:mm:ss"));
                console.log("Time Elapsed Since Borrowed:", getTimeElapsed(chiBorrowtime));
            } else {
                console.log("Invalid Borrow Time");
            }

            if (matchingRecord.pGhtime) {
                const chiReturntime = convertChinaToChicagoTime(matchingRecord.pGhtime);
                console.log("Battery Returned:", chiReturntime ? chiReturntime.toFormat("yyyy-MM-dd HH:mm:ss") : "Invalid Return Time");
            } else {
                console.log("Battery Returned: Battery still active");
            }
        }
    })
    .catch(error => console.error("Error:", error.message));
