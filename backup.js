const axios = require('axios');
const Binance = require('binance-api-node').default;
const { SMA, RSI, ATR } = require('technicalindicators');
var common_func = require('./common.js');

const symbol = 'SUIUSDT' //'BTCUSDT' SUIUSDT; // Replace with the symbol of the coin you want to check
const asset = 'USDT';

// Thiết lập mức đòn bẩy (Leverage)
const setLeverage = async (symbol, leverage) => {
    try {
        const response = await common_func.client.futuresLeverage({
            symbol: symbol,
            leverage: leverage
        });
        console.log(`Leverage set to ${leverage}x for ${symbol}:`, response);
    } catch (error) {
        console.error('Error setting leverage:', error);
    }
};

// Example usage
const main = async () => {
    var currentPrice = await common_func.getPrice(symbol);

    console.log(`-----------**************START***************-----------`);
    console.log(`The current price of ${symbol} is ${currentPrice}`);

    
    await common_func.determineTradeAction(symbol);
    return;

    var historicalData = await common_func.getHistoricalData(symbol);

    currentPrice = parseFloat(currentPrice);
    historicalData.push(currentPrice);
    historicalData.shift();
    console.log('historicalData: ' + historicalData);


    if (historicalData && historicalData.length >= 20) {
        console.log('-------◆◆◆◆◆◆◆-------');
        // Tính MA ngắn hạn (10 kỳ) và MA dài hạn (20 kỳ)
        const shortTermMA = common_func.calculateMA(historicalData.slice(-10), 10);
        const longTermMA = common_func.calculateMA(historicalData.slice(-20), 20);

        // const currentPrice = historicalData[historicalData.length - 1]; // Giá đóng cửa gần nhất
        // console.log(`MA ngắn hạn: ${shortTermMA}`);
        // console.log(`MA dài hạn: ${longTermMA}`);
        // console.log(`Giá hiện tại: ${currentPrice}`);

        var isLong = null;
        if (shortTermMA > longTermMA) {
            // console.log('Tín hiệu: Long (Mua) - Giá hiện tại: ' + currentPrice);
            isLong = true;
        } else if (shortTermMA < longTermMA) {
            // console.log('Tín hiệu: Short (Bán) - Giá hiện tại: ' + currentPrice);
            isLong = false;
        } else {
            console.log('Tín hiệu: Chờ đợi => exit;');
            return;
        }

        console.log('-------◆◆◆◆◆◆◆-------');
        const riskRewardRatio = 1; // Tỷ lệ rủi ro/lợi nhuận mong muốn
        const historicalDataFutures = await common_func.getHistoricalFutures(symbol);
        // var price = await common_func.getPrice(symbol);
        // historicalDataFutures.push(price);
        // historicalDataFutures.shift();
        // console.log(`historicalDataFutures: ${historicalDataFutures}`);
        const atr = common_func.calculateATR(historicalDataFutures);
        const lastClose = historicalDataFutures[historicalDataFutures.length - 1][4]; // Giá đóng cửa cuối cùng

        const stopLossForLong = lastClose - 1.5 * atr;  // Đặt Stop Loss cho lệnh Long
        const stopLossForShort = lastClose + 1.5 * atr; // Đặt Stop Loss cho lệnh Short

        const takeProfitForLong = parseFloat(lastClose + (lastClose - stopLossForLong) * riskRewardRatio); // Chốt lời Long
        const takeProfitForShort = lastClose - (stopLossForShort - lastClose) * riskRewardRatio; // Chốt lời Short

        var stopLoss;
        var side;
        var take_profit;
        var final_take_profit;
        var takeProfitPrice;
        var quantity = 6;
        const leverage = 10;

        if (isLong == true) {
            // Long
            stopLoss = parseFloat(stopLossForLong);
            side = 'BUY';
            if (stopLoss > currentPrice) {
                // false
                console.log('Dữ liệu không thể dự đoán => exit;');
                // return;
            }
            take_profit = parseFloat(takeProfitForLong == NaN ? null : parseFloat(takeProfitForLong));
            takeProfitPrice = parseFloat(common_func.calculateTakeProfit(currentPrice, stopLoss, riskRewardRatio));
            final_take_profit = (takeProfitPrice + take_profit) / 2;
        } else {
            // Short
            stopLoss = parseFloat(stopLossForShort);
            side = 'SELL';
            if (stopLoss < currentPrice) {
                // false
                console.log('Dữ liệu không thể dự đoán => exit;');
                // return;
            }
            takeProfitPrice = parseFloat(common_func.calculateTakeProfit(currentPrice, stopLoss, riskRewardRatio));
            take_profit = parseFloat(takeProfitForShort == NaN ? null : parseFloat(takeProfitForShort));
            final_take_profit = takeProfitPrice;
        }

        console.log(`ATR: ${atr}`);
        console.log(`Stop Loss cho Long: ${parseFloat(stopLossForLong)}`);
        console.log(`Take Profit cho Long: ${parseFloat(takeProfitForLong)}`);
        console.log(`Stop Loss cho Short: ${parseFloat(stopLossForShort)}`);
        console.log(`Take Profit cho Short: ${takeProfitForShort}`);

        console.log('-------●●●●●●●SUMARY●●●●●●●-------');
        if (isLong == true) {
            console.log('Tín hiệu: Long (Mua) - Giá hiện tại: ' + currentPrice);
        } else {
            console.log('Tín hiệu: Short (Bán) - Giá hiện tại: ' + currentPrice);
        }
        console.log(`Final Take Profit Price: ${parseFloat(final_take_profit)}`);
        console.log(`Final Stop Loss Price: ${stopLoss}`);

        // console.log('number: ' + Number(Number(currentPrice).toFixed(3)))

        // get balance futures
        var balance = await common_func.getFuturesBalance(asset);
        if (balance) {
            console.log(`Current ${asset} Balance in Futures Wallet:`, balance);
            // Nếu số dư đủ, thực hiện lệnh Long/Short
            if (balance >= 5) { // Đảm bảo rằng bạn có ít nhất 5 USDT (hoặc giá trị tương ứng) để giao dịch
                balance = parseFloat(balance);
                quantity = Number(Number(balance / currentPrice).toFixed(2));
                console.log(`quantity to order: ${quantity}`);
                if (quantity <= 5) {
                    console.log(`quantity not enought to order: ${quantity} => exit;`);
                    return;
                }
            } else {
                console.error('Not enough balance to place the order. => exit;');
                return;
            }
        } else {
            console.error(`Could not retrieve ${asset} balance. => exit;`);
            return;
        }

        // Thiết lập đòn bẩy Leverage
        await setLeverage(symbol, leverage);
        // await futuresOrder(symbol, quantity, currentPrice, side);

    } else {
        console.log('Dữ liệu không đủ để tính toán MA');
    }
    console.log(`-----------**************END***************-----------`);
};

main();