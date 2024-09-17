const axios = require('axios');
const Binance = require('binance-api-node').default;
const { SMA, RSI, ATR, ADX, MACD, BollingerBands } = require('technicalindicators');
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
            open: parseFloat(candle.open),
            close: parseFloat(candle.close),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            volume: parseFloat(candle.volume),
            timestamp: candle.closeTime // Lấy timestamp của nến đóng
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
        // Lấy dữ liệu nến 15 phút với giới hạn 1 nến gần nhất
        const candles = await client.futuresCandles({
            symbol: symbol,
            interval: '15m',
            limit: 10 // Lấy cây nến gần nhất
        });
        return candles;
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
            // utils.customLog('minNotionalFilter: ');
            // console.log(minNotionalFilter);
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
        // utils.customLog(`before round quantity: ${quantity}`);
        // utils.customLog(`quantityPrecision: ${quantityPrecision}`);
        // utils.customLog(`minNotional: ${minNotional}`);

        // Điều chỉnh số lượng nếu không đạt mức tối thiểu
        if (orderValue < minNotional) {
            roundedQuantity = roundToPrecision(minNotional / currentPrice, quantityPrecision);
            orderValue = roundedQuantity * currentPrice;

            if (orderValue < minNotional) {
                console.error(`Order value ${orderValue} is less than minimum notional ${minNotional}.`);
                return;
            }
        }

        // utils.customLog(`orderValue: ${orderValue}`);
        utils.customLog(`roundedQuantity: ${roundedQuantity}`);

        // Làm tròn các giá trị theo giới hạn
        const roundedStopLoss = stopLoss ? roundToPrecision(stopLoss, pricePrecision) : null;
        const roundedTakeProfit = takeProfit ? roundToPrecision(takeProfit, pricePrecision) : null;

        utils.customLog(`roundedStopLoss: ${roundedStopLoss}`);
        utils.customLog(`roundedTakeProfit: ${roundedTakeProfit}`);
        utils.customLog(`-------`);

        const order = await client.futuresOrder({
            symbol: symbol,
            side: side,
            type: 'MARKET', // Không thêm tham số 'price' cho lệnh MARKET
            quantity: roundedQuantity
        });
        utils.customLog(`${side} Order Placed: id: ${order.orderId}, time: ${order.updateTime}`);
        // console.log(`${side} Order Placed:`, order);

        // // Đặt lệnh Stop Loss và Take Profit nếu cần
        // if (roundedStopLoss) {
        //     const stopOrder = await client.futuresOrder({
        //         symbol: symbol,
        //         side: side === 'BUY' ? 'SELL' : 'BUY', // Đặt ngược lại với lệnh ban đầu
        //         type: 'STOP_MARKET',
        //         stopPrice: roundedStopLoss,
        //         quantity: roundedQuantity
        //     });
        //     utils.customLog(`Stop Loss Order Placed: id: ${stopOrder.orderId}, time: ${stopOrder.updateTime}`);
        //     // console.log('Stop Loss Order Placed:', stopOrder);
        // }

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

                // utils.customLog(`Symbol: ${symbol}`);
                utils.customLog(`positionAmt: ${Number(positionAmt)}`);
                utils.customLog(`${utils.FgGreen}Unrealized PnL:${utils.Reset} ${unrealizedProfit.toFixed(2)} USD`);
                utils.customLog(`Closing Fee: ${closingFee} USD`);
                utils.customLog(`PnL after Fees: ${pnlAfterFees.toFixed(2)} USD`);
                // utils.customLog(`PnL Percentage after Fees: ${pnlPercentageAfterFees.toFixed(2)}%`);
                if (parseFloat(positionAmt) > 0) {
                    if (currentAction == 'SELL') {
                        isStop = true;
                        utils.customLog(`${utils.FgRed} Current position is BUY but new position is SELL => Stop loss as soon as posible${utils.Reset}`);
                    }
                } else {
                    if (currentAction == 'BUY') {
                        isStop = true;
                        utils.customLog(`${utils.FgRed} Current position is SELL but new position is BUY => Stop loss as soon as posible${utils.Reset}`);
                    }
                }
                if (isStop == false) {
                    if (unrealizedProfit < 0) {
                        utils.customLog('→ Are losing money');
                        // Check time of position is > 30 minutes or not
                        let orderedTime = new Date(position.updateTime);
                        let currentdate = new Date();
                        let diffMs = currentdate - orderedTime;
                        let diffMins = diffMs / 60000; // minutes
                        if (diffMins > 15) {   // If > 30 minutes
                            utils.customLog(`${utils.BgMagenta}Checking market status for define stop loss...${utils.Reset}`);
                            let newStopLoss = await monitorMarketAndAdjustStopLoss(symbol, positionAmt);
                            if (newStopLoss != null) {
                                // If market price have a large change => stop loss.
                                isStop = true;
                            } else {
                                isStop = false;
                            }
                        } else {
                            isStop = false;
                        }
                    } else if (unrealizedProfit > closingFee) {
                        if (unrealizedProfit >= (closingFee * 2)) {
                            isStop = true;
                            utils.customLog(`${utils.FgYellow}→ Take profit${utils.Reset}`);
                        } else {
                            utils.customLog('→ Not enough profit!!');
                        }
                    } else {
                        utils.customLog('→ Not enough profit!!');
                    }
                }

                if (isStop == false) {
                    utils.customLog('→ Keep hold current position.....');
                    return;
                }

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

                utils.customLog(`Closed ${symbol} position: updateTime ${order.updateTime}`);
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
        return true;
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

        let action = 'HOLD';
        let stopLoss = null;
        let takeProfit = null;
        if (lastShortTermMA > lastLongTermMA
            && lastRSI > 50 && lastRSI < 70
            && volumes[volumes.length - 1] > averageVolume
        ) {
            action = 'BUY';
            stopLoss = latestClose - (1.5 * lastATR);
            takeProfit = latestClose + (1.5 * lastATR);
        } else if (lastShortTermMA < lastLongTermMA
            && lastRSI < 50 && lastRSI > 30
            // && volumes[volumes.length - 1] > averageVolume
        ) {
            action = 'SELL';
            stopLoss = latestClose + (1.5 * lastATR);
            takeProfit = latestClose - (1.5 * lastATR);
        }
        utils.customLog(`lastShortTermMA: ${lastShortTermMA}, lastLongTermMA: ${lastLongTermMA} (Short > Long => BUY(${utils.FgYellow}${lastShortTermMA > lastLongTermMA}${utils.Reset}), else => SELL)`);
        utils.customLog(`lastRSI: ${lastRSI}, (> 50, <70 => BUY(${utils.FgYellow}${lastRSI > 50 && lastRSI < 70}${utils.Reset}), else => SELL)`);
        utils.customLog(`lastest volume: ${volumes[volumes.length - 1]},averageVolume: ${averageVolume} (lastest > averageVolume(${utils.FgYellow}${volumes[volumes.length - 1] > averageVolume}${utils.Reset}))`);
        utils.customLog(`→　New suggest action: ${utils.FgYellow}${action}${utils.Reset}`);
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
        utils.customLog(`Action: ${utils.FgYellow} ${marketStatus.action} ${utils.Reset}`);
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

const getLastClosedPosition = async (symbol) => {
    try {
        // Lấy lịch sử giao dịch trên futures
        const trades = await client.futuresUserTrades({ symbol: symbol, limit: 50 });

        // Lọc ra những vị thế đã đóng
        const closedTrades = trades.filter(trade => trade.realizedPnl !== '0');

        if (closedTrades.length === 0) {
            console.log('Không có vị thế nào đã đóng.');
            return null;
        }

        // Lấy vị thế đã đóng gần nhất
        const lastClosedTrade = closedTrades[closedTrades.length - 1];

        //   console.log('Vị thế đã đóng gần nhất:', lastClosedTrade);
        return lastClosedTrade;
    } catch (error) {
        console.error('Error fetching closed positions:', error);
        return null;
    }
};

// Giám Sát ADX và Volume để Điều Chỉnh Stop Loss
const monitorMarketAndAdjustStopLoss = async (symbol, _position) => {
    try {
        let position = parseFloat(_position) > 0 ? 'BUY' : 'SELL';
        const data = await getHistoricalDataCustom(symbol, '15m');

        if (data.length < 21) {
            console.error('Not enough data to calculate ADX or Volume.');
            return null;
        }

        const closePrices = data.map(d => d.close);
        const highPrices = data.map(d => d.high);
        const lowPrices = data.map(d => d.low);
        const volumes = data.map(d => d.volume);

        let stopLoss = null;

        // Apply ADX for check market
        const adx = ADX.calculate({
            period: 14,
            close: closePrices,
            high: highPrices,
            low: lowPrices
        });

        const latestClose = closePrices[closePrices.length - 1];
        const latestADX = adx[adx.length - 1];
        const averageVolume = SMA.calculate({ period: 20, values: volumes });
        const latestVolume = volumes[volumes.length - 1];

        utils.customLog(`Latest ADX: ${latestADX.adx},Latest/Average Volume: ${latestVolume}/${averageVolume[averageVolume.length - 1]} (if ADX > 25)`);

        // Điều chỉnh Stop Loss dựa trên vị thế
        if (latestADX.adx > 25 && latestVolume > averageVolume[averageVolume.length - 1]) {
            utils.customLog('Strong trend detected. Adjusting Stop Loss.');

            if (position === 'BUY') {
                // Nếu đang ở vị thế BUY, stop loss phải thấp hơn giá hiện tại
                stopLoss = latestClose - (latestClose * 0.005); // 0.5% thấp hơn giá hiện tại
            } else if (position === 'SELL') {
                // Nếu đang ở vị thế SELL, stop loss phải cao hơn giá hiện tại
                stopLoss = latestClose + (latestClose * 0.005); // 0.5% cao hơn giá hiện tại
            }
            utils.customLog(`${utils.FgRed} Adjusted new stop Loss for ${position}: ${stopLoss}`);
        }
        // in case stopLoss is still null, continue use other method to check. 
        if (stopLoss != null) {
            return stopLoss;
        }
        // Continue Apply RSI, MACD for check markets
        // Tính RSI
        const rsiValues = RSI.calculate({
            period: 14,
            values: closePrices
        });
        const latestRSI = rsiValues[rsiValues.length - 1];

        // Tính MACD
        const macdInput = {
            values: closePrices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false, // EMA
            SimpleMASignal: false
        };
        const macd = MACD.calculate(macdInput);
        const latestMACD = macd[macd.length - 1];

        // Điều kiện để đặt stop loss nếu RSI cho thấy thị trường có xu hướng đảo chiều
        if (position === 'BUY') {
            utils.customLog(`Current RSI: ${latestRSI} (>70), (MACD < signal: ${latestMACD.MACD < latestMACD.signal})`);
            if (latestRSI > 70 && latestMACD.MACD < latestMACD.signal) {
                utils.customLog('RSI indicates overbought, potential for price reversal.');
                stopLoss = latestClose - (latestClose * 0.005); // 0.5% thấp hơn giá hiện tại
                utils.customLog(`${utils.FgRed} Adjusted new stop Loss for ${position}: ${stopLoss}`);
            } else {
                utils.customLog('Market seems stable, no immediate action taken.');
            }
        } else if (position === 'SELL') {
            utils.customLog(`Current RSI: ${latestRSI} (<30), (MACD > signal: ${latestMACD.MACD > latestMACD.signal})`);
            if (latestRSI < 30 && latestMACD.MACD > latestMACD.signal) {
                utils.customLog('RSI indicates oversold, potential for price reversal.');
                stopLoss = latestClose + (latestClose * 0.005); // 0.5% cao hơn giá hiện tại
                utils.customLog(`${utils.FgRed} Adjusted new stop Loss for ${position}: ${stopLoss}`);
            } else {
                utils.customLog('→ Market seems stable, no immediate action taken.');
            }
        }
        return stopLoss;
        // Có thể thêm logic đặt lệnh stop loss ở đây
    } catch (error) {
        console.error('Monitor Market And Adjust Stop Loss:', error);
        return null;
    }
};

//  kết hợp sử dụng RSI, ATR, MACD, và Volume nhằm xác định khả năng đảo chiều của thị trường
const determineTrendReversal = async (symbol) => {
    const data = await getHistoricalDataCustom(symbol, '15m');

    if (data.length < 26) {
        console.error('Not enough data to calculate indicators.');
        return;
    }

    const closePrices = data.map(d => d.close);
    const highPrices = data.map(d => d.high);
    const lowPrices = data.map(d => d.low);
    const volumes = data.map(d => d.volume);

    const averageVolume = volumes.reduce((acc, val) => acc + val, 0) / volumes.length;
    const latestVolume = volumes[volumes.length - 1];

    // Tính RSI
    const rsi = RSI.calculate({ period: 14, values: closePrices });
    const latestRSI = rsi[rsi.length - 1];

    // Tính ATR
    const atr = ATR.calculate({ period: 14, high: highPrices, low: lowPrices, close: closePrices });
    const latestATR = atr[atr.length - 1];

    // Tính MACD
    const macdInput = {
        values: closePrices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false, // Sử dụng EMA
        SimpleMASignal: false
    };
    const macd = MACD.calculate(macdInput);
    const latestMACD = macd[macd.length - 1];

    let action = 'HOLD';

    // Phân tích RSI và MACD để xác định xu hướng đảo chiều
    // if ((latestRSI > 65 || latestMACD.MACD < latestMACD.signal) && latestATR > atr[atr.length - 2]) {
    if ((latestRSI > 70 || latestMACD.MACD < latestMACD.signal) && latestVolume > averageVolume) {
        // Quá mua, MACD cho tín hiệu bán, khối lượng tăng và biến động tăng
        action = 'SELL';
        // } else if ((latestRSI < 35 || latestMACD.MACD > latestMACD.signal) && latestATR > atr[atr.length - 2]) {
    } else if (latestRSI < 30 || latestMACD.MACD > latestMACD.signal) {
        // Quá bán, MACD cho tín hiệu mua, khối lượng tăng và biến động tăng
        action = 'BUY';
    }
    // console.log(`Action: ${action}`);
    utils.customLog(`Latest RSI: ${latestRSI} (>70 => SELL, <35 => BUY)`);
    utils.customLog(`Latest MACD: ${latestMACD.MACD}, latestMACD.signal: ${latestMACD.signal} (MACD>signal => BUY(${utils.FgYellow}${latestMACD.MACD > latestMACD.signal}), else => SELL)`);
    // utils.customLog(`Latest ATR: ${latestATR}, atr[atr.length - 2]: ${atr[atr.length - 2]}`);
    return action;
};

// Calculate indicators
const calculateIndicators = (data) => {
    const closePrices = data.map(d => d.close);
    const highPrices = data.map(d => d.high);
    const lowPrices = data.map(d => d.low);

    // ATR - Average True Range for volatility
    const atr = ATR.calculate({ period: 14, high: highPrices, low: lowPrices, close: closePrices });

    // RSI - Relative Strength Index for overbought/oversold
    const rsi = RSI.calculate({ period: 14, values: closePrices });

    // Bollinger Bands for volatility expansion/contraction
    const bb = BollingerBands.calculate({
        period: 20,
        values: closePrices,
        stdDev: 2
    });

    return {
        atr,
        rsi,
        bb
    };
};

// Determine if a sudden move happens
const detectSuddenMove = async (symbol) => {

    const data = await getHistoricalDataCustom(symbol, '15m');
    const { atr, rsi, bb } = calculateIndicators(data);

    const latestATR = atr[atr.length - 1];
    const latestRSI = rsi[rsi.length - 1];
    const latestClose = bb[bb.length - 1].close;
    const lowerBand = bb[bb.length - 1].lower;
    const upperBand = bb[bb.length - 1].upper;

    // Check if ATR suddenly increases indicating a spike in volatility
    const volatilitySpike = latestATR > (1.5 * atr[atr.length - 2]);

    // Check if price moves outside Bollinger Bands
    const outsideUpperBand = latestClose > upperBand;
    const outsideLowerBand = latestClose < lowerBand;

    // Combine conditions
    const suddenMove = volatilitySpike || outsideUpperBand || outsideLowerBand;

    // console.log('Volatility spike:', volatilitySpike);
    // console.log('Price outside Bollinger Bands:', outsideUpperBand || outsideLowerBand);

    return suddenMove;
};

module.exports = {
    client, getHistoricalData, getHistoricalFutures, getPrice,
    calculateMA, calculateATR, calculateTakeProfit, getFuturesBalance,
    determineTradeAction, closeAllPositionsAndOrders, getHistoricalDataCustom,
    getHistoricalDataCustomForAI, confirmMarketStatus, getLastClosedPosition,
    monitorMarketAndAdjustStopLoss, determineTrendReversal, detectSuddenMove
};