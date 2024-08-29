const axios = require('axios');
const tf = require('@tensorflow/tfjs-node');

var common_func = require('./common.js');

const symbol = 'SUIUSDT' //'BTCUSDT' SUIUSDT; // Replace with the symbol of the coin you want to check
const asset = 'USDT';

const prepareData = async () => {
    try {
        const priceData = await common_func.getHistoricalDataCustomForAI(symbol, '15m', 1500);
        // for (let index = 0; index < priceData.length; index++) {
        //     const data = priceData[index];
        //     console.log(data);
        // }

        // Chọn các cột cần thiết
        const timestamps = priceData.map(candle => candle.timestamp);
        const opens = priceData.map(candle => candle.open);
        const highs = priceData.map(candle => candle.high);
        const lows = priceData.map(candle => candle.low);
        const closes = priceData.map(candle => candle.close);
        const volumes = priceData.map(candle => candle.volume);

        // Chuyển đổi thành Tensor
        const tensorData = tf.tensor2d(
            priceData.map(candle => [
                parseFloat(candle.open), // open
                parseFloat(candle.high), // high
                parseFloat(candle.low), // low
                parseFloat(candle.close), // close
                parseFloat(candle.volume)  // volume
            ]),
            [priceData.length, 5]
        );
        return {
            tensorData,
            timestamps,
            opens,
            highs,
            lows,
            closes,
            volumes
        };

    } catch (error) {
        console.error('Lỗi chuẩn bị dữ liệu:', error);
    }
}

async function trainModel(tensorData) {
    // Chia dữ liệu thành dữ liệu huấn luyện và dữ liệu kiểm tra
    const splitIndex = Math.floor(tensorData.shape[0] * 0.8);
    const trainData = tensorData.slice([0, 0], [splitIndex, -1]);
    const testData = tensorData.slice([splitIndex, 0], [-1, -1]);

    // Xây dựng mô hình TensorFlow
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [5], units: 64, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 }));

    model.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError'
    });

    // Huấn luyện mô hình
    await model.fit(trainData.slice([0, 0], [-1, 5]), trainData.slice([0, 4], [-1, 1]), {
        epochs: 50,
        validationData: [testData.slice([0, 0], [-1, 5]), testData.slice([0, 4], [-1, 1])],
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                //   console.log(`Epoch ${epoch + 1}: loss = ${logs.loss}`);
            }
        }
    });

    console.log('Mô hình đã được huấn luyện.');
    return model;
}

async function predictPrice(model, latestData) {
    const inputTensor = tf.tensor2d([latestData], [1, 5]);
    const prediction = model.predict(inputTensor);
    const predictedPrice = prediction.dataSync()[0];

    console.log(`Dự đoán giá tiếp theo: ${predictedPrice}`);
    return predictedPrice;
}


function prepareDataTensor(data, timeStep = 60) {
    // Trích xuất giá đóng cửa
    const closePrices = data.map(candle => candle.close);

    // Chuẩn hóa dữ liệu (giá trị từ 0 đến 1)
    const normalizedPrices = normalize(closePrices);

    // Tạo tập dữ liệu đầu vào và đầu ra
    const { X, Y } = createDataset(normalizedPrices, timeStep);

    return { X, Y };
}

// Example usage
const main = async () => {
    var currentdate = new Date();
    var currentPrice = await common_func.getPrice(symbol);
    console.log(`-----------${currentdate} **************START***************-----------`);
    console.log(`The current price of ${symbol} is ${currentPrice}`);
    // Dự đoán giá với mô hình đã huấn luyện
    prepareData().then(({ tensorData }) => {
        return trainModel(tensorData).then(model => {
            const latestData = tensorData.arraySync()[tensorData.shape[0] - 1];
            return predictPrice(model, latestData);
        });
    }).catch(error => {
        console.error('Lỗi dự đoán giá:', error);
    });

    await prepareData();
};

main();