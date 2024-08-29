import Binance from 'binance-api-node';

const symbol = 'SUIUSDT' //'BTCUSDT' SUIUSDT; // Replace with the symbol of the coin you want to check
const asset = 'USDT';
const takerFee = 0.04;
const leverage = 10;

const client = Binance({
    apiKey: 'gpGTdLODlhOpQDCDc7jPa0yddnXZYUsCuNajBluAtWW7foWMkIt0zPvQcLcMuyYt',
    apiSecret: 'O1eRHWjon81DuNuuqM4ladhGdS0oeIEpxl25kRMw8RaIDhr5AT6IQBDMcRFykXSe',
    futures: true
});

// Thiết lập mức đòn bẩy (Leverage)
async function setLeverage(symbol, leverage) {
    try {
        const response = await client.futuresLeverage({
            symbol: symbol,
            leverage: leverage
        });
        // console.log(`Leverage set to ${leverage}x for ${symbol}:`, response);
        utils.customLog(`Leverage set to ${leverage}x for ${symbol} done.`);
    } catch (error) {
        console.error('Error setting leverage:', error);
    }
};


async function futuresTrade() {
    // Thiết lập đòn bẩy Leverage
    await setLeverage(symbol, leverage);
}

// Example usage
async function main() {
    var i = 1;
    var timmer = 1000 * 60 * 15; // 15 minutes
    futuresTrade();
    function futuresLoop() {
        console.log("■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●■◆●");
        setTimeout(function () {
            futuresTrade();
            i++;
            futuresLoop();
        }, timmer)
    }
    futuresLoop();
};

main();