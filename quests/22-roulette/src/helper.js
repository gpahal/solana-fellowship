const generateRandomNumber = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getTotalAmountToBePaid = (investment) => {
    return investment;
};

const getReturnAmount = (investment, stakeFactor) => {
    return investment * stakeFactor;
};

module.exports = {
    generateRandomNumber,
    getTotalAmountToBePaid,
    getReturnAmount,
};
