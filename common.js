const axios = require('axios');
const Binance = require('binance-api-node').default;
const { SMA, RSI, ATR } = require('technicalindicators');
var utils = require('./utils');

const client = Binance({
    apiKey: 'gpGTdLODlhOpQDCDc7jPa0yddnXZYUsCuNajBluAtWW7foWMkIt0zPvQcLcMuyYt',
    apiSecret: 'O1eRHWjon81DuNuuqM4ladhGdS0oeIEpxl25kRMw8RaIDhr5AT6IQBDMcRFykXSe',
    futures: true
});

const getHistoricalDataCustom = async (symbol, interval, limit = 500) => {
    try {
        const candles = await client.futuresCandles({
            symbol: symbol,
            interval: interval,
            limit: limit
        });

        return candles.map(candle => ({
            close: parseFloat(candle.close),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            volume: parseFloat(candle.volume)
        }));
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return [];
    }
};

const getHistoricalDataCustomForAI = async (symbol, interval, limit = 500) => {
    try {
        const candles = await client.futuresCandles({
            symbol: symbol,
            interval: interval,
            limit: limit
        });

        return candles.map(candle => ({
            timestamp: new Date(candle.openTime).toISOString(), // timestamp là openTime
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: parseFloat(candle.volume),
        }));
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return [];
    }
};

// Hàm lấy dữ liệu lịch sử từ Binance Futures
const getHistoricalData = async (symbol) => {
    try {
        const response = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, {
            params: {
                symbol: symbol.toUpperCase(),
                interval: '15m',
                limit: 20
            }
        });
        return response.data.map(kline => parseFloat(kline[4])); // Giá đóng cửa
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return null;
    }
};

// Hàm lấy dữ liệu lịch sử từ Binance Futures 
const getHistoricalFutures = async (symbol) => {
    try {
        const response = await axios.get(`https://fapi.binance.com/fapi/v1/klines`, {
            params: { symbol: symbol.toUpperCase(), interval: '15m', limit: 20 }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching historical data:', error);
        return null;
    }
};

// Get current price
const getPrice = async (symbol) => {
    try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price`, {
            params: { symbol: symbol.toUpperCase() }
        });
        return response.data.price;
    } catch (error) {
        console.error('Error fetching price:', error);
        return null;
    }
};

const getMinimumNotional = async (symbol) => {
    try {
        const exchangeInfo = await client.futuresExchangeInfo();
        const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

        if (!symbolInfo) {
            console.error(`Symbol ${symbol} not found in exchange info.`);
            return null;
        }

        const minNotionalFilter = symbolInfo.filters.find(f => f.filterType === 'MIN_NOTIONAL');
        if (minNotionalFilter) {
            // In ra thông tin để kiểm tra
            utils.customLog('minNotionalFilter: ');
            console.log(minNotionalFilter);
            if (minNotionalFilter.minNotional == undefined) {
                return parseFloat(minNotionalFilter.notional);
            }
            return parseFloat(minNotionalFilter.minNotional);
        } else {
            console.error('MIN_NOTIONAL filter not found for symbol.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching minimum notional:', error);
        return null;
    }
};

const getPrecision = async (symbol) => {
    const exchangeInfo = await client.futuresExchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

    const pricePrecision = symbolInfo.pricePrecision;
    const quantityPrecision = symbolInfo.quantityPrecision;

    return { pricePrecision, quantityPrecision };
};

const roundToPrecision = (value, precision) => {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
};

// Hàm tính Đường Trung Bình Động
const calculateMA = (data, period) => {
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    return sum / period;
};

// Hàm tính ATR (Average True Range)
const calculateATR = (data, period = 20) => {
    let trValues = [];
    for (let i = 1; i < data.length; i++) {
        let highLow = data[i][2] - data[i][3]; // High - Low
        let highClose = Math.abs(data[i][2] - data[i - 1][4]); // High - Previous Close
        let lowClose = Math.abs(data[i][3] - data[i - 1][4]); // Low - Previous Close
        trValues.push(Math.max(highLow, highClose, lowClose));
    }
    let atr = trValues.slice(0, period).reduce((acc, val) => acc + val) / period;
    return atr;
};

const calculateTakeProfit = (entryPrice, stopLossPrice, riskRewardRatio) => {
    const riskAmount = Math.abs(entryPrice - stopLossPrice);
    const rewardAmount = riskAmount * riskRewardRatio;

    let takeProfitPrice;
    if (entryPrice > stopLossPrice) {
        // Long position
        takeProfitPrice = entryPrice + rewardAmount;
    } else {
        // Short position
        takeProfitPrice = entryPrice - rewardAmount;
    }
    return takeProfitPrice;
};

// Hàm lấy thông tin số dư trong ví Futures
const getFuturesBalance = async (asset) => {
    try {
        const balances = await client.futuresAccountBalance();
        const balanceInfo = balances.find(b => b.asset === asset);
        return balanceInfo ? balanceInfo.balance : null;
    } catch (error) {
        console.error('Error fetching futures balance:', error);
        return null;
    }
};

const getCurrentPrice = async (symbol) => {
    try {
        const ticker = await client.futuresPrices(symbol);
        return parseFloat(ticker);
    } catch (error) {
        console.error('Error fetching current price:', error);
        return 1; // Trả về giá mặc định nếu gặp lỗi
    }
};

const futuresOrder = async (symbol, side, quantity, stopLoss, takeProfit, currentPrice) => {
    try {

        const { pricePrecision, quantityPrecision } = await getPrecision(symbol);
        const minNotional = await getMinimumNotional(symbol);

        // Làm tròn số lượng và tính toán giá trị lệnh
        let roundedQuantity = roundToPrecision(quantity, quantityPrecision);
        let orderValue = roundedQuantity * currentPrice;

        utils.customLog(`-------`);
        utils.customLog(`before round quantity: ${quantity}`);
        utils.customLog(`quantityPrecision: ${quantityPrecision}`);

        // Điều chỉnh số lượng nếu không đạt mức tối thiểu
        if (orderValue < minNotional) {
            roundedQuantity = roundToPrecision(minNotional / currentPrice, quantityPrecision);
            orderValue = roundedQuantity * currentPrice;

            if (orderValue < minNotional) {
                console.error(`Order value ${orderValue} is less than minimum notional ${minNotional}.`);
                return;
            }
        }

        utils.customLog(`-------`);
        utils.customLog(`orderValue: ${orderValue}`);
        utils.customLog(`minNotional: ${minNotional}`);
        utils.customLog(`roundedQuantity: ${roundedQuantity}`);
        utils.customLog(`-------`);

        // Làm tròn các giá trị theo giới hạn
        const roundedStopLoss = stopLoss ? roundToPrecision(stopLoss, pricePrecision) : null;
        const roundedTakeProfit = takeProfit ? roundToPrecision(takeProfit, pricePrecision) : null;

        utils.customLog(`roundedStopLoss: ${roundedStopLoss}`);
        utils.customLog(`roundedTakeProfit: ${roundedTakeProfit}`);

        const order = await client.futuresOrder({
            symbol: symbol,
            side: side,
            type: 'MARKET', // Không thêm tham số 'price' cho lệnh MARKET
            quantity: roundedQuantity
        });
        utils.customLog(`${side} Order Placed: id: ${order.orderId}, time: ${order.updateTime}`);
        // console.log(`${side} Order Placed:`, order);

        // Đặt lệnh Stop Loss và Take Profit nếu cần
        if (roundedStopLoss) {
            const stopOrder = await client.futuresOrder({
                symbol: symbol,
                side: side === 'BUY' ? 'SELL' : 'BUY', // Đặt ngược lại với lệnh ban đầu
                type: 'STOP_MARKET',
                stopPrice: roundedStopLoss,
                quantity: roundedQuantity
            });
            utils.customLog(`Stop Loss Order Placed: id: ${stopOrder.orderId}, time: ${stopOrder.updateTime}`);
            // console.log('Stop Loss Order Placed:', stopOrder);
        }

        if (roundedTakeProfit) {
            const takeProfitOrder = await client.futuresOrder({
                symbol: symbol,
                side: side === 'BUY' ? 'SELL' : 'BUY', // Đặt ngược lại với lệnh ban đầu
                type: 'TAKE_PROFIT_MARKET',
                stopPrice: roundedTakeProfit,
                quantity: roundedQuantity
            });
            utils.customLog(`Take Profit Order Placed: id: ${takeProfitOrder.orderId}, time: ${takeProfitOrder.updateTime}`);
            // console.log('Take Profit Order Placed:', takeProfitOrder);
        }
    } catch (error) {
        console.error(`Error placing ${side} order:`, error);
    }
};

const closeAllPositionsAndOrders = async (currentAction) => {
    try {
        let isStop = false;
        // Bước 2: Đóng tất cả các vị thế mở
        const positions = await client.futuresPositionRisk();
        const openPositions = positions.filter(position => parseFloat(position.positionAmt) !== 0);

        // Tính phí đóng vị thế (taker fee)
        const takerFeeRate = 0.04 / 100; // Taker fee mặc định là 0.04%

        if (openPositions.length === 0) {
            isStop = true;
            utils.customLog('No open positions found.');
        } else {
            for (const position of openPositions) {

                const { symbol, positionAmt, entryPrice, markPrice } = position;
                // Tính toán lãi/lỗ chưa thực hiện nếu không có sẵn
                let unrealizedProfit = parseFloat(position.unrealizedProfit);
                if (isNaN(unrealizedProfit)) {
                    unrealizedProfit = (parseFloat(markPrice) - parseFloat(entryPrice)) * parseFloat(positionAmt);
                }
                // console.log(position);
                const notionalValue = Math.abs(positionAmt) * parseFloat(markPrice); // Giá trị danh nghĩa (notional value)
                const closingFee = notionalValue * takerFeeRate;

                // Tính lãi/lỗ sau khi trừ phí
                const pnlAfterFees = unrealizedProfit - closingFee;
                const entryValue = Math.abs(parseFloat(positionAmt)) * parseFloat(entryPrice);
                const pnlPercentageAfterFees = (pnlAfterFees / entryValue) * 100;

                utils.customLog(`Symbol: ${symbol}`);
                utils.customLog(`positionAmt: ${Number(positionAmt)}`);
                utils.customLog(`Unrealized PnL: ${unrealizedProfit.toFixed(2)} USD`);
                utils.customLog(`Closing Fee: ${closingFee} USD`);
                utils.customLog(`PnL after Fees: ${pnlAfterFees.toFixed(2)} USD`);
                utils.customLog(`PnL Percentage after Fees: ${pnlPercentageAfterFees.toFixed(2)}%`);

                if (parseFloat(positionAmt) > 0) {
                    if (currentAction == 'SELL') {
                        isStop = true;
                        utils.customLog('Current position is BUY but new position is SELL => Stop loss as soon as posible');
                    }
                } else {
                    if (currentAction == 'BUY') {
                        isStop = true;
                        utils.customLog('Current position is SELL but new position is BUY => Stop loss as soon as posible');
                    }
                }
                if (isStop == false) {
                    if (unrealizedProfit < 0) {
                        utils.customLog('=> Are losing money.....');
                        isStop = false;
                    }
                    if (unrealizedProfit > closingFee) {
                        if (unrealizedProfit >= (closingFee * 1.5)) {
                            isStop = true;
                            utils.customLog('=> Take profit');
                        } else {
                            utils.customLog('=> Not enough profit, keep hold current position.....');
                        }
                    } else {
                        utils.customLog('=> Keep hold current position.....');
                    }
                }

                if (isStop == false) return;

                const quantity = Math.abs(parseFloat(positionAmt));
                const closingSide = parseFloat(positionAmt) > 0 ? 'SELL' : 'BUY';

                utils.customLog(`Closing position for ${symbol}: ${closingSide} ${quantity}`);

                // Đặt lệnh ngược lại để đóng vị thế
                const order = await client.futuresOrder({
                    symbol: symbol,
                    side: closingSide,
                    type: 'MARKET',
                    quantity: quantity,
                });

                console.log(`Closed ${symbol} position: updateTime `, order.updateTime);
            }
            utils.customLog('All positions closed.');
        }

        if (isStop == false) return;
        // Bước 1: Hủy tất cả các lệnh chờ
        const openOrders = await client.futuresOpenOrders();

        if (openOrders.length === 0) {
            isStop = true;
            utils.customLog('No open orders found.');
        } else {
            for (const order of openOrders) {
                const { symbol, orderId } = order;

                await client.futuresCancelOrder({ symbol, orderId });
                utils.customLog(`Cancelled order ${orderId} for symbol ${symbol}`);
            }
            utils.customLog('All open orders cancelled.');
        }
        return isStop;
    } catch (error) {
        console.error('Error closing positions or cancelling orders:', error);
        return false;
    }
};

// Hàm tính toán volume trung bình
const calculateAverageVolume = (volumes, period) => {
    if (volumes.length < period) return 0;
    const recentVolumes = volumes.slice(-period);
    const sum = recentVolumes.reduce((acc, volume) => acc + volume, 0);
    return sum / period;
};

const confirmMarketStatus = async (symbol, currentPrice) => {
    try {
        const data = await getHistoricalDataCustom(symbol, '15m', 21);

        if (data.length < 21) {
            console.error('Not enough data to make a decision.');
            return;
        }

        const closePrices = data.map(d => d.close);
        const highPrices = data.map(d => d.high);
        const lowPrices = data.map(d => d.low);
        const volumes = data.map(d => d.volume);

        // utils.customLog('closePrices: ' + closePrices);
        // utils.customLog('highPrices: ' + highPrices);
        // utils.customLog('lowPrices: ' + lowPrices);

        const shortTermMA = SMA.calculate({ period: 9, values: closePrices });
        const longTermMA = SMA.calculate({ period: 21, values: closePrices });
        const rsi = RSI.calculate({ period: 14, values: closePrices });
        const atr = ATR.calculate({ period: 14, high: highPrices, low: lowPrices, close: closePrices });

        const latestClose = closePrices[closePrices.length - 1];
        const lastShortTermMA = shortTermMA[shortTermMA.length - 1];
        const lastLongTermMA = longTermMA[longTermMA.length - 1];
        const lastRSI = rsi[rsi.length - 1];
        const lastATR = atr[atr.length - 1];

        const averageVolume = calculateAverageVolume(volumes, 20); // Tính toán volume trung bình trong 20 kỳ
        // console.log(volumes);
        // console.log(averageVolume);
        // console.log(volumes[volumes.length - 1]);
        // console.log(volumes[volumes.length - 1] < averageVolume);
        // console.log(lastShortTermMA);
        // console.log(lastLongTermMA);
        // console.log(lastRSI);
        let action = 'HOLD';
        let stopLoss = null;
        let takeProfit = null;
        // if (lastShortTermMA > lastLongTermMA && lastRSI > 50 && volumes[volumes.length - 1] > averageVolume) {
        // } else if (lastShortTermMA < lastLongTermMA && lastRSI < 50 && volumes[volumes.length - 1] > averageVolume) {
        if (lastShortTermMA > lastLongTermMA && lastRSI > 50 && volumes[volumes.length - 1] > averageVolume) {
            action = 'BUY';
            stopLoss = latestClose - (1.5 * lastATR);
            takeProfit = latestClose + (1.5 * lastATR);
        } else if (lastShortTermMA < lastLongTermMA && lastRSI < 50 && volumes[volumes.length - 1] < averageVolume) {
            action = 'SELL';
            stopLoss = latestClose + (1.5 * lastATR);
            takeProfit = latestClose - (1.5 * lastATR);
        }

        // utils.customLog(`price: ${currentPrice}`);
        // utils.customLog(`Action: ${action}`);
        // utils.customLog(`Stop Loss: ${stopLoss}`);
        // utils.customLog(`Take Profit: ${takeProfit}`);
        // utils.customLog(`difference 1: ${takeProfit - currentPrice}`);
        // utils.customLog(`difference 2: ${stopLoss - currentPrice}`);
        return { action, stopLoss, takeProfit };
    } catch (error) {
        console.error('Error closing positions:', error);
        return null;
    }
}

const determineTradeAction = async (symbol, quantity, currentPrice, marketStatus) => {
    try {
        utils.customLog(`${utils.FgYellow} ◆◆◆◆◆SUMMARY◆◆◆◆◆ ${utils.Reset}`);
        utils.customLog(`price: ${currentPrice}`);
        utils.customLog(`quantity: ${quantity}`);
        utils.customLog(`Action: ${marketStatus.action}`);
        utils.customLog(`Stop Loss: ${marketStatus.stopLoss}`);
        utils.customLog(`Take Profit: ${marketStatus.takeProfit}`);
        // utils.customLog(`Profit difference: ${marketStatus.takeProfit - currentPrice}`);
        // utils.customLog(`Loss difference: ${marketStatus.stopLoss - currentPrice}`);
        // Thực hiện lệnh nếu xác định hành động là BUY hoặc SELL
        if (marketStatus.action !== 'HOLD') {
            await futuresOrder(symbol, marketStatus.action, quantity, marketStatus.stopLoss, marketStatus.takeProfit, currentPrice);
        } else {
            utils.customLog(`HOLD => wait for next run!...`);
        }
    } catch (error) {
        console.error('Error closing positions:', error);
    }
};

module.exports = {
    client, getHistoricalData, getHistoricalFutures, getPrice,
    calculateMA, calculateATR, calculateTakeProfit, getFuturesBalance,
    determineTradeAction, closeAllPositionsAndOrders, getHistoricalDataCustom,
    getHistoricalDataCustomForAI, confirmMarketStatus
};