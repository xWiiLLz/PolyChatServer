/**
 *
 * @param {User} user - The user
 * @param {string} message - the message to send
 */
const trySendMessage = (user, message) => {
    try {
        user.client.send(message);
    } catch (e) {
        console.count(`An error occured when trying to send the message to the user ${user.username} - Details: ${e}`);
    }
};

const tryClose = (client, code = 1006, message = '') => {
    try {
        client.close(code, message);
    } catch (e) {
        // Breaks silently
    }
};

function limitedLengthArray(length) {
    let array = new Array();

    array.push = function () {
        if (this.length >= length) {
            this.shift();
        }
        return Array.prototype.push.apply(this,arguments);
    };

    return array;
}

module.exports = {
    trySendMessage,
    tryClose,
    limitedLengthArray,
};