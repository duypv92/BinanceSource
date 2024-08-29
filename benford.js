const axios = require('axios');
const Binance = require('binance-api-node').default;
var common_func = require('./common.js');

const client = Binance({
    apiKey: 'gpGTdLODlhOpQDCDc7jPa0yddnXZYUsCuNajBluAtWW7foWMkIt0zPvQcLcMuyYt',
    apiSecret: 'O1eRHWjon81DuNuuqM4ladhGdS0oeIEpxl25kRMw8RaIDhr5AT6IQBDMcRFykXSe',
    futures: true
});

const symbol = 'SUIUSDT' //'BTCUSDT' SUIUSDT; // Replace with the symbol of the coin you want to check
const asset = 'USDT';

async function getClosingPrices(symbol, interval, startTime) {
    const priceData = await common_func.getHistoricalDataCustomForAI(symbol, '15m', 1500);
    const closes = priceData.map(candle => candle.close);
    // const data = await client.futuresCandles(symbol, interval, { limit: 1000, startTime });
    return closes; // Giá đóng cửa
}

function getLeadingDigit(number) {
    return parseInt(number.toString()[0]);
}

function checkBenfordLaw(prices) {
    const counts = Array(9).fill(0);

    prices.forEach(price => {
        const leadingDigit = getLeadingDigit(price);
        if (leadingDigit > 0) {
            counts[leadingDigit - 1]++;
        }
    });

    const total = counts.reduce((a, b) => a + b, 0);
    const frequencies = counts.map(count => count / total);

    console.log("Tần suất chữ số đầu tiên (1 đến 9):", frequencies);
}

// Example usage
const main = async () => {
    const interval = '1d';
    const startTime = Date.now() - (10 * 24 * 60 * 60 * 1000); // Lấy dữ liệu của 1 năm
    const closingPrices = await getClosingPrices(symbol, interval, startTime);
    checkBenfordLaw(closingPrices);
};

main();